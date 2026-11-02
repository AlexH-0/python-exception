"""Teaching boundaries: JSON -> validated tasks -> bounded retry -> commit.

Idempotency is in-memory and single-process. Workers must be pure or independently
idempotent: retry cannot undo arbitrary external side effects.
"""
from dataclasses import dataclass
import json
import logging
from pathlib import Path
import time
from typing import Callable

logger = logging.getLogger(__name__)


class TaskError(Exception):
    """Expected failures callers may isolate per task."""


class InputError(TaskError):
    """Invalid file, JSON, schema or conflicting idempotency key."""


class TransientError(TaskError):
    """Temporary worker failure; retry is permitted within a fixed budget."""


class PermanentError(TaskError):
    """Worker explicitly rejects a task; retry will not repair it."""


@dataclass(frozen=True)
class Task:
    id: str
    value: int

    def __post_init__(self):
        if not isinstance(self.id, str) or not self.id.strip():
            raise InputError("task id must be a nonempty string")
        if type(self.value) is not int:
            raise InputError("task value must be an integer, not bool")


@dataclass(frozen=True)
class Result:
    id: str
    status: str
    value: int | None = None
    error: str | None = None
    attempts: int = 0


def parse_tasks(text: str) -> list[Task]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise InputError("invalid task JSON") from error
    if not isinstance(data, list):
        raise InputError("root must be a list")
    tasks = []
    for index, item in enumerate(data):
        if not isinstance(item, dict) or set(item) != {"id", "value"}:
            raise InputError(f"task {index}: expected exactly id and value")
        try:
            tasks.append(Task(item["id"], item["value"]))
        except InputError as error:
            error.add_note(f"task index: {index}")
            raise
    return tasks


def load_tasks(path: str | Path) -> list[Task]:
    try:
        with Path(path).open(encoding="utf-8") as source:
            text = source.read()
    except (OSError, UnicodeError) as error:
        raise InputError("cannot read task file") from error
    return parse_tasks(text)


class Processor:
    def __init__(self, worker: Callable[[Task], int] | None = None, *,
                 max_attempts: int = 3, base_delay: float = 0.01,
                 max_delay: float = 0.1, sleep: Callable[[float], None] = time.sleep):
        if type(max_attempts) is not int or max_attempts < 1:
            raise ValueError("max_attempts must be a positive integer")
        if base_delay < 0 or max_delay < 0:
            raise ValueError("delays must be nonnegative")
        self.worker = worker if worker is not None else lambda task: task.value * 2
        self.max_attempts, self.base_delay, self.max_delay = max_attempts, base_delay, max_delay
        self.sleep = sleep
        self._committed: dict[str, tuple[int, int]] = {}

    @property
    def committed(self) -> dict[str, int]:
        return {key: output for key, (_, output) in self._committed.items()}

    def process_one(self, task: Task) -> Result:
        existing = self._committed.get(task.id)
        if existing is not None:
            if existing[0] != task.value:
                raise InputError(f"conflicting value for task id: {task.id}")
            return Result(task.id, "cached", value=existing[1])
        for attempt in range(1, self.max_attempts + 1):
            try:
                value = self.worker(task)
            except TransientError as error:
                if attempt == self.max_attempts:
                    error.add_note(f"task {task.id}; exhausted {attempt} attempts")
                    raise
                logger.warning("retry task=%s attempt=%s", task.id, attempt)
                self.sleep(min(self.max_delay, self.base_delay * 2 ** (attempt - 1)))
            else:
                # Commit only a successful result. No partially written output.
                self._committed[task.id] = (task.value, value)
                return Result(task.id, "done", value=value, attempts=attempt)
        raise AssertionError("unreachable")

    def process_batch(self, tasks: list[Task]) -> list[Result]:
        results = []
        for task in tasks:
            try:
                results.append(self.process_one(task))
            except TaskError as error:
                logger.exception("task failed id=%s", task.id)
                results.append(Result(task.id, "failed", error=f"{type(error).__name__}: {error}"))
        return results

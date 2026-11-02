"""Generate finite, real observations for chapter 12's task processor."""
import argparse
import contextlib
import dataclasses
import io
import json
import logging
import platform
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from python.task_processor import (InputError, PermanentError, Processor,
                                   TransientError, parse_tasks)

TARGET = ROOT / "src/data/project.json"


def code_for_entry(text):
    return f'''import json
from dataclasses import asdict
from python.task_processor import InputError, Processor, parse_tasks

text = {text!r}
calls = []
def worker(task):
    calls.append(task.id)
    return task.value * 2
try:
    tasks = parse_tasks(text)
except InputError as error:
    observation = {{"accepted": False, "tasks": [], "calls": calls,
                   "error": type(error).__name__,
                   "cause": type(error.__cause__).__name__ if error.__cause__ else None,
                   "notes": list(getattr(error, "__notes__", []))}}
else:
    results = Processor(worker).process_batch(tasks)
    observation = {{"accepted": True, "tasks": [{{"id": t.id, "value": t.value}} for t in tasks],
                   "calls": calls, "results": [asdict(r) for r in results],
                   "error": None, "cause": None, "notes": []}}
print(json.dumps(observation, ensure_ascii=False))
'''


ENTRY = [
    ("valid", "合法 JSON：整批校验后执行", '[{"id":"a","value":2},{"id":"b","value":3}]'),
    ("bad-json", "JSON 语法错误：未开始执行", "{"),
    ("invalid-row", "后续行字段错误：不执行任何任务", '[{"id":"a","value":2},{"id":"b","value":true}]'),
]


def execute_code(code):
    output = io.StringIO()
    logger = logging.getLogger("python.task_processor.processor")
    old_disabled = logger.disabled
    logger.disabled = True
    try:
        with contextlib.redirect_stdout(output):
            exec(compile(code, "<chapter12-project>", "exec"), {"__name__": "__main__"})
    finally:
        logger.disabled = old_disabled
    return json.loads(output.getvalue())


def observe_entry(code):
    return execute_code(code)


def code_for_batch(kind):
    failure = {"expected": 'raise PermanentError("rejected")',
               "exhausted": 'raise TransientError("busy")',
               "bug": 'raise TypeError("worker bug")'}[kind]
    attempts = 2 if kind == "exhausted" else 3
    return f'''import json
from dataclasses import asdict
from python.task_processor import Processor, PermanentError, Task, TransientError

calls, delays = [], []
def worker(task):
    calls.append(task.id)
    if task.id == "b":
        {failure}
    return task.value * 2
processor = Processor(worker, max_attempts={attempts}, sleep=delays.append)
tasks = [Task("a", 2), Task("b", -1), Task("c", 3)]
try:
    results = processor.process_batch(tasks)
except TypeError as error:
    observation = {{"tasks": [{{"id": task.id, "value": task.value}} for task in tasks],
                   "results": None, "calls": calls, "delays": delays,
                   "committed": processor.committed, "error": type(error).__name__}}
else:
    observation = {{"tasks": [{{"id": task.id, "value": task.value}} for task in tasks],
                   "results": [asdict(result) for result in results],
                   "calls": calls, "delays": delays, "committed": processor.committed,
                   "error": None}}
print(json.dumps(observation, ensure_ascii=False))
'''


def observe_batch(code):
    return execute_code(code)


def code_for_cache(ident):
    if ident in {"same", "conflict"}:
        values = '[{"id":"a","value":2},{"id":"a","value":2}]' if ident == "same" else '[{"id":"a","value":2},{"id":"a","value":9},{"id":"b","value":3}]'
        body = f'''processor = Processor(worker)
results = processor.process_batch(parse_tasks({values!r}))
'''
    else:
        body = '''one, two = Processor(worker), Processor(worker)
first = one.process_batch(parse_tasks('[{"id":"a","value":2}]'))
second = two.process_batch(parse_tasks('[{"id":"a","value":2}]'))
results = first + second
processor = two
'''
    return f'''import json
from dataclasses import asdict
from python.task_processor import Processor, parse_tasks
calls = []
def worker(task):
    calls.append(task.id)
    return task.value * 2
{body}observation = {{"results": [asdict(r) for r in results], "calls": calls,
               "committed": processor.committed}}
print(json.dumps(observation, ensure_ascii=False))
'''


def observe_cache(ident):
    return execute_code(code_for_cache(ident))


def cli_rows():
    valid = subprocess.run([sys.executable, "-m", "python.task_processor"], cwd=ROOT,
                           text=True, capture_output=True, check=False)
    with tempfile.TemporaryDirectory() as directory:
        bad = Path(directory) / "bad.json"
        bad.write_text("{", encoding="utf-8")
        invalid = subprocess.run([sys.executable, "-m", "python.task_processor", str(bad)],
                                 cwd=ROOT, text=True, capture_output=True, check=False)
    return [
        {"id": "valid", "label": "默认样例文件", "exitCode": valid.returncode,
         "stdout": valid.stdout, "stderrLastLine": valid.stderr.splitlines()[-1] if valid.stderr else ""},
        {"id": "invalid", "label": "损坏 JSON 文件", "exitCode": invalid.returncode,
         "stdout": invalid.stdout, "stderrLastLine": invalid.stderr.splitlines()[-1] if invalid.stderr else ""},
    ]


def generate():
    entries = []
    for ident, label, text in ENTRY:
        code = code_for_entry(text)
        observation = observe_entry(code)
        observation.pop("results", None)
        entries.append({"id": ident, "label": label, "text": text, "code": code,
                        **observation})
    batches = []
    labels = {"expected": "预期任务错误：隔离并继续", "exhausted": "重试耗尽：隔离并继续", "bug": "未知缺陷：中断批次"}
    for ident in ("expected", "exhausted", "bug"):
        code = code_for_batch(ident)
        observation = observe_batch(code)
        batches.append({"id": ident, "label": labels[ident], "code": code, **observation})
    cache = []
    for ident, label in (("same", "相同键和值：复用已提交结果"),
                         ("conflict", "相同键不同值：隔离冲突"),
                         ("fresh", "新实例：缓存不跨处理器")):
        code = code_for_cache(ident)
        cache.append({"id": ident, "label": label, "code": code, **execute_code(code)})
    return {"pythonVersion": platform.python_version(), "entry": entries,
            "batches": batches, "cache": cache, "cli": cli_rows()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = generate()
    if args.check:
        assert json.loads(TARGET.read_text(encoding="utf-8")) == data
        print("Verified chapter 12 project evidence")
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Generated chapter 12 project evidence")


if __name__ == "__main__":
    main()

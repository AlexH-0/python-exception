"""Fail-fast TaskGroup extension; cancellation is deliberately not swallowed."""
import asyncio
from collections.abc import Awaitable, Callable
from .processor import Task, InputError


async def process_group(tasks: list[Task], worker: Callable[[Task], Awaitable[int]]) -> dict[str, int]:
    if len({task.id for task in tasks}) != len(tasks):
        raise InputError("async batch requires unique task ids")
    handles = []
    async with asyncio.TaskGroup() as group:
        for task in tasks:
            handles.append((task.id, group.create_task(worker(task))))
    # This batch result exists only if every child succeeded.
    return {task_id: handle.result() for task_id, handle in handles}

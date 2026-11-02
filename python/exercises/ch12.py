# 本章练习：先读网站任务与 tests/python/test_exercises.py，再实现函数。
from python.task_processor import Processor

def run_batch(tasks, worker=None):
    """处理 Task 列表，返回 Result 列表；隔离 TaskError，有限重试，缓存同输入并拒绝冲突，可复用 Processor。"""
    raise NotImplementedError('Implement this exercise')

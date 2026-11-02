# 本章练习：先读网站任务与 tests/python/test_exercises.py，再实现函数。
from contextlib import contextmanager

@contextmanager
def managed(events, suppress=False):
    """实现上下文管理器：记录 open，yield "resource"，最后记录 close；suppress 真时仅抑制 ValueError。"""
    raise NotImplementedError('Implement this exercise')

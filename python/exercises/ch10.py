# 本章练习：先读网站任务与 tests/python/test_exercises.py，再实现函数。
from time import sleep as real_sleep
from python.task_processor import TransientError

def retry(operation, attempts=3, sleep=real_sleep):
    """仅重试 TransientError；最多 attempts 次，延迟 0.01、0.02…；耗尽重新抛出原异常。"""
    raise NotImplementedError('Implement this exercise')

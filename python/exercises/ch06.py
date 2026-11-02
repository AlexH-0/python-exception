# 本章练习：先读网站任务与 tests/python/test_exercises.py，再实现函数。
class InputError(Exception):
    pass

def convert(text):
    """整数转换失败时将 ValueError 转为本模块 InputError，并用 from 保留 cause；其他错误传播。"""
    raise NotImplementedError('Implement this exercise')

# 本章练习：先读网站任务与 tests/python/test_exercises.py，再实现函数。
import logging
logger = logging.getLogger(__name__)

def diagnose(operation):
    """调用 operation，正常返回 None；普通异常用 logger.exception 记录并返回(类名, 消息)，控制流异常传播。"""
    raise NotImplementedError('Implement this exercise')

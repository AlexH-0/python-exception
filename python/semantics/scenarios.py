"""Small, standalone Python 3.11 examples. Outputs are generated, never stored here."""
from textwrap import dedent

SCENARIOS = []


def add(id, title, question, prediction, code, notes=""):
    SCENARIOS.append(dict(id=id, chapter=id[:2], title=title, question=question,
                          prediction=prediction, code=dedent(code).strip(), notes=notes))


add("01-errors", "异常发生之后", "转换失败后，下一行还会执行吗？", "before 后出现 ValueError，after 不执行。", '''
print("before")
number = int("not-a-number")
print("after", number)
''', "轨迹来自真实 CPython。line 事件在该行执行之前触发；exception 事件才表示异常已经发生。")

for mode in ("normal", "error", "else-error"):
    add(f"02-match-{mode}", {"normal": "正常路径与 else", "error": "子类首先匹配", "else-error": "else 的异常不回到同组 except"}[mode],
        "else 与 except 能在这次执行中先后运行吗？", "正常完成 try 才进入 else；else 中的新异常继续向外传播。", f'''
mode = {mode!r}
try:
    print("try")
    if mode == "error":
        raise KeyError("task")
except LookupError:
    print("lookup handled")
except Exception:
    print("general handled")
else:
    print("else")
    if mode == "else-error":
        raise ValueError("outside handler range")
finally:
    print("finally")
print("done")
''')

for mode in ("normal", "error", "return", "break", "continue", "override"):
    add(f"03-finally-{mode}", f"finally：{mode}", "清理发生在什么时刻，待完成的控制转移会保留吗？",
        "finally 总会在此示例的离开路径运行；清理抛错会替代待传播的异常。", f'''
def run():
    for index in range(2):
        try:
            print("try", index)
            if {mode!r} in ("error", "override"):
                raise ValueError("original")
            if {mode!r} == "return":
                return "saved return"
            if {mode!r} == "break":
                break
            if {mode!r} == "continue":
                continue
        finally:
            print("cleanup", index)
            if {mode!r} == "override":
                raise RuntimeError("cleanup failed")
        print("loop tail", index)
    return "finished"
print(run())
''', "只覆盖正常 Python 控制流；强制终止进程、断电等不保证清理。")

add("03-finally-return-override", "finally return 吞掉异常", "原异常还能传播吗？", "finally 的 return 覆盖待传播异常。", '''
def run():
    try:
        raise ValueError("original")
    finally:
        return "overridden"
print(run())
''', "危险反例；Python 3.14 对离开 finally 的 return/break/continue 发出 SyntaxWarning，3.11 不发出。")

add("04-stack", "从内向外展开调用栈", "谁先清理，谁捕获？", "leaf 清理，然后 middle 清理，最后外层捕获。", '''
def leaf():
    try:
        print("leaf starts")
        raise ValueError("bad record")
    finally:
        print("leaf cleanup")
def middle():
    try:
        leaf()
        print("unreachable")
    finally:
        print("middle cleanup")
try:
    middle()
except ValueError as error:
    print("outer caught", type(error).__name__)
''')

add("05-hierarchy", "Exception 的边界", "except Exception 能捕获 SystemExit 吗？", "不能；外层显式 SystemExit 处理器捕获它。", '''
print(issubclass(ValueError, Exception))
print(issubclass(SystemExit, Exception))
try:
    try:
        raise SystemExit(2)
    except Exception:
        print("ordinary error")
    finally:
        print("cleanup")
except SystemExit as error:
    print("exit code", error.code)
''')

for mode in ("explicit", "none"):
    add("06-chain" if mode == "explicit" else "06-chain-none", "显式异常链" if mode == "explicit" else "隐藏显示不删除上下文",
        "__cause__、__context__、__suppress_context__ 是什么？", "from None 仍保留 __context__，只抑制默认链显示。", f'''
try:
    try:
        int("bad")
    except ValueError as original:
        raise RuntimeError("invalid task") from {"original" if mode == "explicit" else "None"}
except RuntimeError as error:
    print("cause", type(error.__cause__).__name__)
    print("context", type(error.__context__).__name__)
    print("suppressed", error.__suppress_context__)
''')

add("06-reraise", "裸 raise 保留异常对象", "重新抛出的是否还是原对象？", "是；裸 raise 重新抛出当前活动异常。", '''
original = ValueError("bad task")
try:
    try:
        raise original
    except ValueError as error:
        error.add_note("task id: 7")
        raise
except ValueError as error:
    print("same object", error is original)
    print(error.__notes__[0])
''')

add("07-contract", "在边界转换异常", "调用者应该依赖 JSON 实现细节吗？", "边界转换成业务异常，同时用 from 保留诊断链。", '''
import json
class TaskInputError(Exception):
    pass
def parse(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise TaskInputError("task JSON is invalid") from error
try:
    parse("{")
except TaskInputError as error:
    print(type(error).__name__)
    print("cause", type(error.__cause__).__name__)
''')

add("08-with", "__exit__ 有条件抑制", "with 体失败后还能继续吗？", "__exit__ 对 ValueError 返回真，异常被抑制。", '''
class Resource:
    def __enter__(self):
        print("enter")
        return self
    def __exit__(self, exc_type, exc, tb):
        print("exit", exc_type.__name__)
        return exc_type is ValueError
with Resource():
    print("body")
    raise ValueError("recoverable")
print("continued")
''')

add("08-enter-fail", "进入失败没有对应退出", "__enter__ 失败会调用本对象的 __exit__ 吗？", "不会；资源获得阶段需自己处理部分初始化。", '''
class Resource:
    def __enter__(self):
        print("enter failed")
        raise OSError("cannot open")
    def __exit__(self, *args):
        print("never called")
with Resource():
    print("never entered")
''')

add("08-exitstack", "ExitStack 逆序清理", "第二个资源失败时，第一个怎么办？", "已注册的清理回调仍按后进先出执行。", '''
from contextlib import ExitStack
try:
    with ExitStack() as stack:
        stack.callback(print, "cleanup first")
        stack.callback(print, "cleanup second")
        print("acquired two")
        raise OSError("third acquisition failed")
except OSError:
    print("caught")
''')

add("09-diagnose", "诊断保留原始位置", "怎样记录异常类型和调用顺序？", "traceback 提取调用帧，日志在 except 内使用 logger.exception。", '''
import traceback
def convert():
    return int("bad")
try:
    convert()
except ValueError as error:
    frames = traceback.extract_tb(error.__traceback__)
    print(" -> ".join(frame.name for frame in frames))
    print(type(error).__name__)
''', "仅输出帧名称，避免机器路径不确定性。日志与 pytest 的完整案例见本地项目和测试。")

add("10-retry", "只重试可恢复故障", "尝试次数有限吗，何时提交结果？", "两次暂时失败后成功；成功时只提交一次。", '''
class TransientError(Exception):
    pass
committed = {}
for attempt in range(1, 4):
    try:
        print("attempt", attempt)
        if attempt < 3:
            raise TransientError("busy")
        committed.setdefault("task-1", 42)
    except TransientError:
        if attempt == 3:
            raise
        print("retry scheduled")
    else:
        break
print("committed", len(committed))
''', "真实项目注入 sleep 并采用有上限的指数退避；此场景无等待。setdefault 只演示单进程内存幂等，不能替代跨进程事务。")

add("11-group", "except* 可匹配多个分支", "只运行第一个匹配分支吗？", "不同叶子可匹配不同 except* 分支。", '''
try:
    raise ExceptionGroup("batch", [ValueError("a"), TypeError("b")])
except* ValueError as group:
    print("value", len(group.exceptions))
except* TypeError as group:
    print("type", len(group.exceptions))
print("all handled")
''')

add("11-group-residual", "剩余异常继续传播", "未匹配的 KeyError 会消失吗？", "未匹配部分组成剩余异常组继续向外传播。", '''
try:
    try:
        raise ExceptionGroup("batch", [ValueError("a"), KeyError("b")])
    except* ValueError as group:
        print("handled", type(group.exceptions[0]).__name__)
except ExceptionGroup as remainder:
    print("remaining", type(remainder.exceptions[0]).__name__)
''')

add("11-group-nested", "拆分保留嵌套结构", "按叶子匹配会展平原树吗？", "不会；匹配子组仍保留相关嵌套路径。", '''
try:
    raise ExceptionGroup("outer", [ExceptionGroup("inner", [ValueError("a"), TypeError("b")]), ValueError("c")])
except* ValueError as group:
    print("value top children", len(group.exceptions))
    print("nested", type(group.exceptions[0]).__name__)
except* TypeError as group:
    print("type leaf", type(group.exceptions[0].exceptions[0]).__name__)
''')

add("11-cancel", "取消后清理并传播", "except Exception 会吞掉取消吗？", "CancelledError 派生自 BaseException；finally 执行，取消继续传播。", '''
import asyncio
async def main():
    started = asyncio.Event()
    async def worker():
        try:
            print("started")
            started.set()
            await asyncio.Event().wait()
        except Exception:
            print("ordinary handler")
        finally:
            print("cleanup")
    task = asyncio.create_task(worker())
    await started.wait()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("cancel propagated")
asyncio.run(main())
''', "Event 保证任务已经启动才取消；不依赖固定毫秒延迟。协程追踪栈是当前物理帧，不能当作完整逻辑 await 链。")

add("11-taskgroup", "失败触发同伴取消", "TaskGroup 什么时候将异常交给调用者？", "先取消并等待同伴清理，再抛出异常组；同伴取消不加入普通失败列表。", '''
import asyncio
async def main():
    started = asyncio.Event()
    async def waiting():
        try:
            print("peer ready")
            started.set()
            await asyncio.Event().wait()
        finally:
            print("peer cleanup")
    async def failing():
        await started.wait()
        print("worker failed")
        raise ValueError("bad task")
    try:
        async with asyncio.TaskGroup() as group:
            group.create_task(waiting())
            group.create_task(failing())
    except* ValueError as errors:
        print("group failures", len(errors.exceptions))
asyncio.run(main())
''', "只承诺此 Event 同步场景的事件顺序；不泛化到任意并发调度。")

add("11-generator", "生成器边界与 close", "StopIteration 和 GeneratorExit 会怎样跨越生成器？", "生成器内逃逸的 StopIteration 转为 RuntimeError；close 注入 GeneratorExit 并执行 finally。", '''
def broken():
    yield 1
    raise StopIteration("inside")
iterator = broken()
print(next(iterator))
try:
    next(iterator)
except RuntimeError as error:
    print("converted", type(error.__cause__).__name__)
def resource():
    try:
        yield "open"
    finally:
        print("generator cleanup")
iterator = resource()
print(next(iterator))
iterator.close()
''')

add("12-project", "每任务失败隔离", "一个坏任务是否终止整批任务？", "输入边界只捕获预期转换错误，记录失败并继续下一个任务。", '''
tasks = [("a", "2"), ("b", "bad"), ("c", "5")]
successes = []
failures = []
for task_id, raw in tasks:
    try:
        value = int(raw)
    except ValueError as error:
        failures.append(task_id)
        print("failed", task_id, type(error).__name__)
    else:
        successes.append(task_id)
        print("done", task_id, value * 2)
print("summary", len(successes), len(failures))
''', "这是项目隔离策略的最小演示；完整文件/JSON/校验/重试/日志/幂等实现见 python/task_processor。")

# Short, focused scripts for the guided finally lesson.
for mode, cleanup in (
    ("keep", 'print("cleanup")'),
    ("replace", 'print("cleanup")\n        return 9'),
    ("fail", 'print("cleanup")\n        raise OSError("cleanup failed")'),
):
    add(f"03-result-{mode}", {"keep": "保留原返回值", "replace": "清理时返回新值", "fail": "清理时抛错"}[mode],
        "return 4 之后，调用者最终收到什么？",
        {"keep": "先输出cleanup，再返回4。", "replace": "finally中的return 9覆盖原返回值4。", "fail": "清理抛出的OSError中断返回流程，调用者收不到4。"}[mode], f'''
def run():
    try:
        return 4
    finally:
        {cleanup}
print(run())
''', "教学基线为Python3.11。finally中的return是用于说明覆盖行为的危险反例。")

add("03-error-replace", "清理失败替代原异常", "清理也出错，调用者看到哪个异常？",
    "RuntimeError成为最终异常，ValueError留在其__context__中。", '''
def run():
    try:
        raise ValueError("original")
    finally:
        print("cleanup")
        raise RuntimeError("cleanup failed")
run()
''', "最终异常与原异常上下文不同；清理失败并不等于原错误没有发生。")

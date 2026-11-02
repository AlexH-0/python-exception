"""Generate finite, real Python evidence for chapter 11 concurrency lessons."""
import argparse
import contextlib
import io
import json
import platform
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "src/data/concurrency.json"


def execute(code):
    """Run the exact complete snippet stored for learners and decode its JSON."""
    stream = io.StringIO()
    with contextlib.redirect_stdout(stream):
        exec(compile(code, "<chapter11-concurrency>", "exec"), {"__name__": "__main__"})
    return json.loads(stream.getvalue())


TREE_HELPER = '''def exception_tree(error):
    node = {"type": type(error).__name__, "message": str(error)}
    if isinstance(error, BaseExceptionGroup):
        node["children"] = [exception_tree(child) for child in error.exceptions]
    return node
'''


def split_code():
    return '''import json
''' + TREE_HELPER + '''
root = ExceptionGroup("outer", [
    ExceptionGroup("inner", [ValueError("v"), TypeError("t")]),
    KeyError("k"),
])
results = []
for name, kind in (("ValueError", ValueError), ("TypeError", TypeError), ("Exception", Exception)):
    matched, remainder = root.split(kind)
    results.append({"id": name,
                    "matched": exception_tree(matched) if matched else None,
                    "remainder": exception_tree(remainder) if remainder else None})
print(json.dumps({"original": exception_tree(root), "cases": results}, ensure_ascii=False))
'''


def group_setup(group_expr):
    return f'''def build_group():
    return {group_expr}
'''


def route_code(ident):
    cases = {
        "ordinary": ('''ExceptionGroup("batch", [ValueError("v"), TypeError("t")])''', "ordinary"),
        "all": ('''ExceptionGroup("batch", [ValueError("v"), TypeError("t")])''', "star-all"),
        "residual": ('''ExceptionGroup("batch", [ValueError("v"), KeyError("k")])''', "star-residual"),
        "nested": ('''ExceptionGroup("outer", [ExceptionGroup("inner", [ValueError("v"), TypeError("t")]), KeyError("k")])''', "star-nested"),
    }
    expr, mode = cases[ident]
    prefix = '''import json
''' + TREE_HELPER + group_setup(expr) + '''
events = []
handled = []
remainder = None
'''
    if mode == "ordinary":
        body = '''try:
    try:
        raise build_group()
    except ValueError as caught:
        events.append("handled ValueError")
        handled.append({"type": "ValueError", "tree": exception_tree(caught)})
except ExceptionGroup as caught:
    events.append("outer received")
    remainder = exception_tree(caught)
'''
    else:
        body = '''try:
    try:
        raise build_group()
    except* ValueError as caught:
        events.append("handled ValueError")
        handled.append({"type": "ValueError", "tree": exception_tree(caught)})
    except* TypeError as caught:
        events.append("handled TypeError")
        handled.append({"type": "TypeError", "tree": exception_tree(caught)})
except ExceptionGroup as caught:
    events.append("outer received")
    remainder = exception_tree(caught)
'''
    return prefix + body + f'''print(json.dumps({{"id": {ident!r}, "handled": handled,
                       "remainder": remainder, "events": events}}, ensure_ascii=False))
'''


def cancel_code(counter):
    if counter:
        handler = '''        except asyncio.CancelledError:
            events.append("cancellation swallowed")
            return "pretend success"
'''
        ident = "counter"
    else:
        handler = '''        except Exception:
            events.append("ordinary handler")
'''
        ident = "normal"
    return f'''import asyncio
import json

async def main():
    started = asyncio.Event()
    events = []
    cleaned = False
    async def worker():
        nonlocal cleaned
        try:
            events.append("worker started")
            started.set()
            await asyncio.Event().wait()
{handler}        finally:
            cleaned = True
            events.append("cleanup")
    task = asyncio.create_task(worker())
    await started.wait()
    task.cancel()
    events.append("cancel requested")
    returned = None
    try:
        returned = await task
        events.append("caller received value")
    except asyncio.CancelledError:
        events.append("caller received cancellation")
    result = {{"id": {ident!r}, "events": events,
              "cancelled": task.cancelled(), "returned": returned,
              "cleaned": cleaned}}
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(main())
'''


def taskgroup_code(cleanup_error):
    ident = "cleanup-error" if cleanup_error else "clean"
    raise_cleanup = '            raise RuntimeError("cleanup failed")\n' if cleanup_error else ""
    return f'''import asyncio
import json
''' + TREE_HELPER + f'''
async def main():
    peer_started = asyncio.Event()
    events = []
    peer_task = None
    caught_tree = None
    async def peer():
        try:
            events.append("peer ready")
            peer_started.set()
            await asyncio.Event().wait()
        finally:
            events.append("peer cleanup")
{raise_cleanup}    async def worker():
        await peer_started.wait()
        events.append("worker failed")
        raise ValueError("worker failed")
    try:
        async with asyncio.TaskGroup() as group:
            peer_task = group.create_task(peer())
            group.create_task(worker())
    except ExceptionGroup as caught:
        events.append("group received")
        caught_tree = exception_tree(caught)
    leaves = []
    def collect(node):
        if node.get("children"):
            for child in node["children"]:
                collect(child)
        else:
            leaves.append(node["type"])
    collect(caught_tree)
    result = {{"id": {ident!r}, "events": events,
              "tree": caught_tree, "leaves": leaves,
              "peerCancelled": peer_task.cancelled(),
              "peerDone": peer_task.done()}}
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(main())
'''


def generator_code(kind):
    specs = {
        "return": ('''        return 9\n''', '''try:
    next(iterator)
except StopIteration as caught:
    error = type(caught).__name__
    value = caught.value
'''),
        "stop": ('''        raise StopIteration("inside")\n''', '''try:
    next(iterator)
except RuntimeError as caught:
    error = type(caught).__name__
    cause = type(caught.__cause__).__name__ if caught.__cause__ else None
'''),
        "close": ("", '''value = iterator.close()
'''),
    }
    body, observe = specs[kind]
    close_handler = '''    except GeneratorExit:
        events.append("GeneratorExit received")
        raise
''' if kind == "close" else ""
    return f'''import json

events = []
cleaned = False
error = None
cause = None
value = None
def resource():
    global cleaned
    try:
        events.append("yield open")
        yield "open"
{body}{close_handler}    finally:
        cleaned = True
        events.append("cleanup")
iterator = resource()
first = next(iterator)
events.append("caller received " + first)
{observe}result = {{"id": {kind!r}, "events": events, "error": error,
          "cause": cause, "value": value, "cleaned": cleaned}}
print(json.dumps(result, ensure_ascii=False))
'''

def generate():
    split_observation = execute(split_code())
    splits = split_observation["cases"]
    routes = []
    for ident in ("ordinary", "all", "residual", "nested"):
        code = route_code(ident)
        routes.append({"id": ident, "label": {
            "ordinary": "普通 except 接收整个异常组",
            "all": "except* 两个分支分别处理",
            "residual": "未匹配的异常组继续传播",
            "nested": "匹配与残留保留嵌套路径",
        }[ident], "code": code, **execute(code)})
    cancels = []
    for counter in (False, True):
        code = cancel_code(counter)
        cancels.append({"code": code, **execute(code)})
    taskgroups = []
    for cleanup_error in (False, True):
        code = taskgroup_code(cleanup_error)
        taskgroups.append({"label": "同伴正常清理" if not cleanup_error else "同伴清理也抛错",
                           "code": code, **execute(code)})
    generators = []
    for kind in ("return", "stop", "close"):
        code = generator_code(kind)
        generators.append({"label": {"return": "正常 return", "stop": "意外 StopIteration", "close": "显式 close"}[kind],
                           "code": code, **execute(code)})
    return {"pythonVersion": platform.python_version(),
            "split": {"code": split_code(), **split_observation},
            "routes": routes, "cancel": cancels,
            "taskgroups": taskgroups, "generators": generators}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = generate()
    if args.check:
        saved = json.loads(TARGET.read_text(encoding="utf-8"))
        if saved != data:
            raise SystemExit("Concurrency evidence mismatch; regenerate and inspect the diff")
        print("Verified chapter 11 concurrency evidence")
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Generated chapter 11 concurrency evidence with Python {platform.python_version()}")


if __name__ == "__main__":
    main()

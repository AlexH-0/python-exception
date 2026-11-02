"""Run trusted course examples and export real CPython tracing events."""
import argparse
import builtins
import contextlib
import io
import json
from pathlib import Path
import platform
import sys

from python.semantics.scenarios import SCENARIOS

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "src/data/traces.json"


def describe(value):
    if isinstance(value, BaseException):
        return f"{type(value).__name__}({str(value)!r})"
    if value is None or isinstance(value, (bool, int, float, str)):
        return repr(value)
    if isinstance(value, (list, tuple)) and len(value) <= 8:
        return repr(value) if all(isinstance(x, (str, int, bool, type(None))) for x in value) else None
    return None


def exception_tree(error):
    """Preserve group nesting and leaf types without unstable object addresses."""
    node = {"type": type(error).__name__, "message": str(error)}
    if isinstance(error, BaseExceptionGroup):
        node["children"] = [exception_tree(child) for child in error.exceptions]
    return node


def run_scenario(spec):
    stream = io.StringIO()
    steps = []
    filename = f"<course:{spec['id']}>"

    def record(frame, event, explanation):
        # A callback (e.g. ExitStack calling print) may originate in stdlib code.
        # Attribute its output to the nearest active course frame.
        while frame and frame.f_code.co_filename != filename:
            frame = frame.f_back
        if frame is None:
            return
        stack, current = [], frame
        while current:
            if current.f_code.co_filename == filename:
                stack.append(current.f_code.co_name)
            current = current.f_back
        state = {}
        for key, value in frame.f_locals.items():
            if not key.startswith("__") and key != "print":
                display = describe(value)
                if display is not None:
                    state[key] = display
                if isinstance(value, BaseException):
                    state[f"{key}.__cause__"] = describe(value.__cause__)
                    state[f"{key}.__context__"] = describe(value.__context__)
                    state[f"{key}.__suppress_context__"] = str(value.__suppress_context__)
                    if isinstance(value, BaseExceptionGroup):
                        state[f"{key}.tree"] = json.dumps(exception_tree(value), ensure_ascii=False)
        steps.append(dict(line=max(1, frame.f_lineno), event=event, explanation=explanation,
                          output=stream.getvalue().splitlines(), stack=stack[::-1], state=state))

    def trace(frame, event, arg):
        if frame.f_code.co_filename != filename:
            return None
        if event == "line":
            record(frame, "line", "即将执行高亮行；变量与输出显示执行此行之前的状态。")
        elif event == "call":
            record(frame, "call", f"进入或恢复 {frame.f_code.co_name}；协程恢复也会产生 call 事件。")
        elif event == "exception":
            error = arg[1]
            record(frame, "exception", f"此帧收到 {type(error).__name__}: {error}；随后可能在当前帧捕获，也可能继续传播。")
        elif event == "return":
            record(frame, "return", "离开或暂停当前帧。此追踪事件也可能来自异常展开或 yield/await，不能单凭它断言正常返回。")
            if steps:
                steps[-1]["state"]["trace.return_arg"] = describe(arg) or type(arg).__name__
        return trace

    def course_print(*args, **kwargs):
        builtins.print(*args, **kwargs)
        record(sys._getframe(1), "output", "本行 print 已执行；输出已追加。")

    error = None
    previous = sys.gettrace()
    try:
        with contextlib.redirect_stdout(stream):
            sys.settrace(trace)
            exec(compile(spec["code"], filename, "exec"), {"__name__": "__main__", "print": course_print})
    except BaseException as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        sys.settrace(previous)
    return {**spec, "steps": steps, "output": stream.getvalue().splitlines(),
            "exception": error, "pythonVersion": platform.python_version()}


def generate():
    return [run_scenario(spec) for spec in SCENARIOS]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare with committed baseline (version metadata ignored)")
    args = parser.parse_args()
    actual = generate()
    if args.check:
        saved = json.loads(TARGET.read_text(encoding="utf-8"))
        for item in actual + saved:
            item.pop("pythonVersion", None)
        if saved != actual:
            raise SystemExit("Trace mismatch: regenerate with the pinned Python 3.11 environment and inspect the diff")
        print(f"Verified {len(actual)} real Python scenarios")
    else:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(json.dumps(actual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Generated {len(actual)} scenarios with Python {platform.python_version()}")


if __name__ == "__main__":
    main()

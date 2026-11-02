"""Behavioral exercise grading: import actual code, never inspect source keywords."""
import importlib
import os
import traceback
import pytest
from python.task_processor import Task, InputError, TransientError, PermanentError


def implementation(chapter):
    target = os.getenv("COURSE_IMPL", "solutions")
    if target not in {"solutions", "exercises"}:
        raise ValueError("COURSE_IMPL must be solutions or exercises")
    return importlib.import_module(f"python.{target}.{chapter}")


@pytest.mark.parametrize("text, expected", [("42", 42), (" -3 ", -3), ("0", 0)])
def test_ch01_valid(text, expected):
    assert implementation("ch01").parse_count(text) == expected


def test_ch01_invalid():
    with pytest.raises(ValueError):
        implementation("ch01").parse_count("4.2")


def test_ch02_scope():
    fn = implementation("ch02").read_key
    assert fn({"a": 0}, "a", 9) == 0
    assert fn({}, "a", 9) == 9
    with pytest.raises(TypeError):
        fn({}, [], 9)


@pytest.mark.parametrize("fail", [False, True])
def test_ch03_cleanup(fail):
    events = []
    fn = implementation("ch03").compute
    if fail:
        with pytest.raises(ValueError, match="failed"):
            fn(events, fail=True)
    else:
        assert fn(events) == 2
    assert events == ["work", "cleanup"]


def test_ch04_traceback():
    fn = implementation("ch04").outer
    assert fn("7") == 7
    with pytest.raises(ValueError) as caught:
        fn("bad")
    names = [frame.name for frame in traceback.extract_tb(caught.value.__traceback__)]
    assert names[-2:] == ["outer", "convert"]


@pytest.mark.parametrize("error, category", [(ValueError(), "ordinary"), (OSError(), "ordinary"),
                                             (SystemExit(), "control"), (KeyboardInterrupt(), "control"),
                                             (GeneratorExit(), "control")])
def test_ch05_hierarchy(error, category):
    assert implementation("ch05").classify(error) == category


def test_ch06_chain():
    module = implementation("ch06")
    assert module.convert("12") == 12
    with pytest.raises(module.InputError) as caught:
        module.convert("bad")
    error = caught.value
    assert isinstance(error.__cause__, ValueError)
    assert error.__context__ is error.__cause__
    assert error.__suppress_context__ is True
    with pytest.raises(TypeError):
        module.convert(None)


@pytest.mark.parametrize("data", [{}, {"id": "a", "value": True}, {"id": "", "value": 1},
                                  {"id": "a", "value": "1"}, {"id": "a", "value": 1, "extra": 2}, []])
def test_ch07_invalid(data):
    with pytest.raises(InputError):
        implementation("ch07").validate_task(data)


def test_ch07_valid():
    assert implementation("ch07").validate_task({"id": "x", "value": 0}) == Task("x", 0)


def test_ch08_cleanup_and_suppression():
    fn = implementation("ch08").managed
    events = []
    with fn(events) as value:
        assert value == "resource"
    assert events == ["open", "close"]
    events.clear()
    with fn(events, suppress=True):
        raise ValueError("safe")
    assert events == ["open", "close"]
    for error in [ValueError("unsafe"), TypeError("bug")]:
        with pytest.raises(type(error)):
            with fn([], suppress=isinstance(error, TypeError)):
                raise error


def test_ch09_diagnostic(caplog):
    fn = implementation("ch09").diagnose
    def fail():
        raise ValueError("bad")
    assert fn(fail) == ("ValueError", "bad")
    assert caplog.records[-1].exc_info[0] is ValueError
    assert fn(lambda: 42) is None
    def stop():
        raise SystemExit(2)
    with pytest.raises(SystemExit):
        fn(stop)


def test_ch10_retry():
    fn = implementation("ch10").retry
    calls, delays = [], []
    def work():
        calls.append(1)
        if len(calls) < 3:
            raise TransientError("busy")
        return 8
    assert fn(work, sleep=delays.append) == 8
    assert delays == [0.01, 0.02]
    error = TransientError("still busy")
    calls.clear()
    def fail():
        calls.append(1)
        raise error
    with pytest.raises(TransientError) as caught:
        fn(fail, attempts=2, sleep=lambda _: None)
    assert caught.value is error and len(calls) == 2
    with pytest.raises(ValueError):
        fn(work, attempts=0)
    def permanent():
        raise PermanentError("never retry")
    with pytest.raises(PermanentError):
        fn(permanent, sleep=lambda _: pytest.fail("retried permanent error"))


def test_ch11_recursive_split():
    first, second, third = ValueError("a"), TypeError("b"), ValueError("c")
    group = ExceptionGroup("outer", [ExceptionGroup("inner", [first, second]), third])
    matched, rest = implementation("ch11").split_values(group)
    assert matched.message == rest.message == "outer"
    assert matched.exceptions[0].exceptions == (first,)
    assert matched.exceptions[1] is third
    assert rest.exceptions[0].exceptions == (second,)
    assert implementation("ch11").split_values(ExceptionGroup("only", [first]))[1] is None


def test_ch12_isolation_idempotency():
    calls = []
    def worker(task):
        calls.append(task.id)
        if task.value < 0:
            raise PermanentError("negative")
        return task.value * 2
    results = implementation("ch12").run_batch([Task("a", 2), Task("b", -1), Task("a", 2), Task("c", 3)], worker)
    assert [r.status for r in results] == ["done", "failed", "cached", "done"]
    assert [r.value for r in results] == [4, None, 4, 6]
    assert calls == ["a", "b", "c"]


def test_ch12_retry_conflict_and_continuation():
    calls = []
    def worker(task):
        calls.append(task.id)
        if len(calls) == 1:
            raise TransientError("busy once")
        return task.value * 2
    results = implementation("ch12").run_batch([Task("a", 2), Task("a", 9), Task("b", 3)], worker)
    assert [r.status for r in results] == ["done", "failed", "done"]
    assert results[0].attempts == 2
    assert results[1].error.startswith("InputError:")
    assert calls == ["a", "a", "b"]

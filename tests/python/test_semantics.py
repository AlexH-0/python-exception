import asyncio
from contextlib import ExitStack
import json
from pathlib import Path
import traceback
import pytest
from python.semantics.generate import generate


def test_browser_vectors_equal_real_python():
    expected = json.loads(Path("src/data/traces.json").read_text(encoding="utf-8"))
    actual = generate()
    for item in expected + actual:
        item.pop("pythonVersion")
    assert actual == expected
    assert len(actual) >= 29
    for scenario in actual:
        assert scenario["steps"]
        for step in scenario["steps"]:
            assert 1 <= step["line"] <= len(scenario["code"].splitlines())
            assert scenario["output"][:len(step["output"])] == step["output"]


def test_trace_displays_real_chain_and_group_tree():
    scenarios = {item["id"]: item for item in generate()}
    states = [step["state"] for step in scenarios["06-chain-none"]["steps"]]
    error_state = next(state for state in states if "error.__context__" in state)
    assert error_state["error.__cause__"] == "None"
    assert error_state["error.__context__"].startswith("ValueError(")
    assert error_state["error.__suppress_context__"] == "True"
    states = [step["state"] for step in scenarios["11-group-nested"]["steps"]]
    group_state = next(state for state in states if "group.tree" in state)
    tree = json.loads(group_state["group.tree"])
    assert tree["type"] == "ExceptionGroup"
    assert tree["children"][0]["children"][0]["type"] == "ValueError"
    assert tree["children"][1]["type"] == "ValueError"


@pytest.mark.parametrize("mode, expected, result", [
    ("normal", ["try", "else", "finally"], "end"),
    ("error", ["try", "except", "finally"], "end"),
    ("return", ["try", "finally"], "early"),
    ("break", ["try", "finally"], "end"),
    ("continue", ["try", "finally"], "end"),
])
def test_else_and_finally_control_transfer(mode, expected, result):
    events = []
    def run():
        for _ in range(1):
            try:
                events.append("try")
                if mode == "error":
                    raise ValueError()
                if mode == "return":
                    return "early"
                if mode == "break":
                    break
                if mode == "continue":
                    continue
            except ValueError:
                events.append("except")
            else:
                events.append("else")
            finally:
                events.append("finally")
        return "end"
    assert run() == result
    assert events == expected


def test_else_errors_are_not_caught_by_sibling_handler():
    events = []
    with pytest.raises(ValueError, match="else"):
        try:
            pass
        except ValueError:
            events.append("incorrect")
        else:
            raise ValueError("else")
        finally:
            events.append("cleanup")
    assert events == ["cleanup"]


def test_finally_overrides_return_and_exception():
    def return_over_return():
        try:
            return 1
        finally:
            return 2
    assert return_over_return() == 2
    def return_over_error():
        try:
            raise ValueError("lost")
        finally:
            return 3
    assert return_over_error() == 3
    with pytest.raises(RuntimeError) as caught:
        try:
            raise ValueError("original")
        finally:
            raise RuntimeError("cleanup")
    assert isinstance(caught.value.__context__, ValueError)
    def error_over_return():
        try:
            return 1
        finally:
            raise RuntimeError("cleanup")
    with pytest.raises(RuntimeError):
        error_over_return()


def test_nested_unwind_and_traceback_order():
    events = []
    def leaf():
        try:
            raise ValueError("broken")
        finally:
            events.append("leaf")
    def middle():
        try:
            leaf()
        finally:
            events.append("middle")
    with pytest.raises(ValueError) as caught:
        middle()
    assert events == ["leaf", "middle"]
    assert [f.name for f in traceback.extract_tb(caught.value.__traceback__)][-2:] == ["middle", "leaf"]


@pytest.mark.parametrize("mode", ["implicit", "explicit", "none"])
def test_chain_object_properties_and_display(mode):
    original = ValueError("original")
    try:
        try:
            raise original
        except ValueError:
            if mode == "explicit":
                raise RuntimeError("outer") from original
            if mode == "none":
                raise RuntimeError("outer") from None
            raise RuntimeError("outer")
    except RuntimeError as error:
        assert error.__context__ is original
        assert error.__cause__ is (original if mode == "explicit" else None)
        assert error.__suppress_context__ is (mode != "implicit")
        formatted = "".join(traceback.format_exception(error))
        assert ("ValueError: original" in formatted) is (mode != "none")


def test_bare_raise_identity_and_no_active_error():
    original = ValueError("x")
    with pytest.raises(ValueError) as caught:
        try:
            raise original
        except ValueError:
            raise
    assert caught.value is original
    with pytest.raises(RuntimeError, match="No active exception"):
        raise


def test_enter_failure_and_exitstack_unwind():
    events = []
    class Resource:
        def __init__(self, name, fail=False):
            self.name, self.fail = name, fail
        def __enter__(self):
            events.append("enter " + self.name)
            if self.fail:
                raise OSError("acquire failed")
            return self
        def __exit__(self, *args):
            events.append("exit " + self.name)
    with pytest.raises(OSError):
        with ExitStack() as stack:
            stack.enter_context(Resource("a"))
            stack.enter_context(Resource("b"))
            stack.enter_context(Resource("c", fail=True))
    assert events == ["enter a", "enter b", "enter c", "exit b", "exit a"]


def test_exit_receives_exception_and_suppresses_only_intended_type():
    received = []
    class Resource:
        def __enter__(self):
            return 7
        def __exit__(self, kind, value, tb):
            received.append((kind, value, tb))
            return kind is ValueError
    error = ValueError("safe")
    with Resource() as value:
        assert value == 7
        raise error
    assert received[0][0] is ValueError and received[0][1] is error and received[0][2] is not None
    with pytest.raises(TypeError):
        with Resource():
            raise TypeError("bug")


def test_except_star_multiple_branches_residual_and_nested_tree():
    values, types, keys = ValueError("v"), TypeError("t"), KeyError("k")
    original = ExceptionGroup("outer", [ExceptionGroup("inner", [values, types]), keys])
    branches = []
    with pytest.raises(ExceptionGroup) as caught:
        try:
            raise original
        except* ValueError as group:
            branches.append("value")
            assert group.exceptions[0].exceptions == (values,)
        except* TypeError as group:
            branches.append("type")
            assert group.exceptions[0].exceptions == (types,)
    assert branches == ["value", "type"]
    assert caught.value.exceptions == (keys,)


def test_base_exception_group_type_and_catch_boundary():
    assert type(BaseExceptionGroup("ordinary", [ValueError()])) is ExceptionGroup
    with pytest.raises(TypeError):
        ExceptionGroup("invalid", [KeyboardInterrupt()])
    original = BaseExceptionGroup("control", [KeyboardInterrupt(), ValueError()])
    with pytest.raises(BaseExceptionGroup) as caught:
        try:
            raise original
        except Exception:
            pytest.fail("Exception must not catch this BaseExceptionGroup")
    assert caught.value is original
    control, rest = original.split(KeyboardInterrupt)
    assert type(control) is BaseExceptionGroup
    assert type(rest) is ExceptionGroup


def test_cancelled_error_cleanup_and_propagation():
    assert issubclass(asyncio.CancelledError, BaseException)
    assert not issubclass(asyncio.CancelledError, Exception)
    async def scenario():
        started, events = asyncio.Event(), []
        async def worker():
            try:
                started.set()
                await asyncio.Event().wait()
            except Exception:
                events.append("incorrect handler")
            finally:
                events.append("cleanup")
        task = asyncio.create_task(worker())
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert task.cancelled() and events == ["cleanup"]
    asyncio.run(scenario())


def test_taskgroup_aggregates_failure_during_peer_cleanup():
    async def scenario():
        started = asyncio.Event()
        async def peer():
            try:
                started.set()
                await asyncio.Event().wait()
            finally:
                raise OSError("cleanup failed")
        async def failing():
            await started.wait()
            raise ValueError("original failure")
        with pytest.raises(ExceptionGroup) as caught:
            async with asyncio.TaskGroup() as group:
                group.create_task(peer())
                group.create_task(failing())
        assert {type(e) for e in caught.value.exceptions} == {ValueError, OSError}
    asyncio.run(scenario())


def test_generator_pep479_close_and_return_value():
    def broken():
        yield 1
        raise StopIteration("wrong")
    it = broken()
    assert next(it) == 1
    with pytest.raises(RuntimeError) as caught:
        next(it)
    assert isinstance(caught.value.__cause__, StopIteration)
    events = []
    def resource():
        try:
            yield 1
        finally:
            events.append("cleanup")
    it = resource()
    next(it)
    assert it.close() is None
    assert events == ["cleanup"]
    def good():
        yield 1
        return 7
    it = good()
    next(it)
    with pytest.raises(StopIteration) as caught:
        next(it)
    assert caught.value.value == 7

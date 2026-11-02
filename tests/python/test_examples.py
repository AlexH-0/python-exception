from pathlib import Path
import runpy
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE_FILES = [
    "01-errors.py", "02-match.py", "03-finally.py", "04-stack.py",
    "05-hierarchy.py", "06-chain.py", "07-contract.py", "08-with.py",
    "09-diagnose.py", "10-retry.py", "11-group.py", "12-project.py",
]


def load_example(name):
    return runpy.run_path(str(ROOT / "python" / "examples" / name))


@pytest.mark.parametrize("name", EXAMPLE_FILES)
def test_example_runs_as_a_python_script(name):
    result = subprocess.run(
        [sys.executable, str(ROOT / "python" / "examples" / name)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_ch01_example_expected_results(capsys):
    namespace = load_example("01-errors.py")
    assert namespace["parse_count"]("17") == 17
    with pytest.raises(ValueError):
        namespace["parse_count"]("bad")
    with pytest.raises(SyntaxError):
        compile("if True print('broken')", "<test>", "exec")
    namespace["__name__"] = "__main__"
    # Execute as a script in an isolated namespace to check dynamically produced diagnostics.
    runpy.run_path(str(ROOT / "python" / "examples" / "01-errors.py"), run_name="__main__")
    output = capsys.readouterr().out
    assert "type: ValueError" in output
    assert "message:" in output
    assert "args:" in output
    assert "parse_count:" in output
    assert "compile error: SyntaxError" in output


def test_ch02_example_only_defaults_missing_keys():
    ns = load_example("02-match.py")
    assert ns["read_key"]({"n": 3}, "n") == 3
    assert ns["read_key"]({}, "n", 8) == 8
    with pytest.raises(TypeError):
        ns["read_key"](None, "n", 8)


def test_ch03_finally_runs_on_success_and_error():
    ns = load_example("03-finally.py")
    events = []
    assert ns["compute"](events) == 2
    assert events == ["work", "cleanup"]
    events.clear()
    with pytest.raises(ValueError, match="failed"):
        ns["compute"](events, fail=True)
    assert events == ["work", "cleanup"]


def test_ch04_exception_crosses_nested_calls():
    ns = load_example("04-stack.py")
    with pytest.raises(ValueError) as info:
        ns["run_task"]("bad")
    assert [frame.name for frame in __import__("traceback").extract_tb(info.value.__traceback__)] == [
        "test_ch04_exception_crosses_nested_calls", "run_task", "parse_record", "convert"
    ]


def test_ch05_baseexception_boundary():
    ns = load_example("05-hierarchy.py")
    assert ns["classify"](ValueError()) == "ordinary"
    assert ns["classify"](KeyboardInterrupt()) == "control"


def test_ch06_chain_is_preserved():
    ns = load_example("06-chain.py")
    with pytest.raises(ns["InputError"]) as info:
        ns["convert"]("bad")
    assert isinstance(info.value.__cause__, ValueError)
    assert info.value.__cause__.__notes__ == ["field=count"]


def test_ch07_domain_exception_fields():
    ns = load_example("07-contract.py")
    error = ns["TaskInputError"]("t-7", "count", "bad value")
    assert error.task_id == "t-7"
    assert error.field == "count"
    assert str(error) == "bad value"
    assert isinstance(error, ns["TaskError"])


def test_ch08_context_exit_and_suppression():
    ns = load_example("08-with.py")
    events = []
    with ns["Managed"](events):
        events.append("work")
    assert events == ["open", "work", "close"]
    events.clear()
    with ns["Managed"](events, suppress=True):
        raise ValueError("expected")
    assert events == ["open", "close"]
    with pytest.raises(TypeError):
        with ns["Managed"]([], suppress=True):
            raise TypeError("unexpected")


def test_ch09_diagnose_returns_type_and_message(caplog):
    ns = load_example("09-diagnose.py")
    with caplog.at_level("ERROR"):
        result = ns["diagnose"](lambda: int("bad"))
    assert result[0] == "ValueError"
    assert "invalid literal" in result[1]
    assert "Traceback" in caplog.text
    assert ns["diagnose"](lambda: 3) is None


def test_ch10_retry_only_transient_and_is_bounded():
    ns = load_example("10-retry.py")
    calls, delays = [], []

    def operation():
        calls.append(None)
        if len(calls) < 3:
            raise ns["TransientError"]("temporary")
        return "done"

    assert ns["retry"](operation, sleep=delays.append) == "done"
    assert len(calls) == 3
    assert delays == [0.01, 0.02]
    with pytest.raises(ValueError):
        ns["retry"](lambda: int("bad"))


def test_ch11_group_split_preserves_unmatched_type():
    ns = load_example("11-group.py")
    group = ExceptionGroup("mixed", [ValueError("bad"), TypeError("wrong")])
    matched, remaining = ns["split_values"](group)
    assert len(matched.exceptions) == 1
    assert isinstance(matched.exceptions[0], ValueError)
    assert len(remaining.exceptions) == 1
    assert isinstance(remaining.exceptions[0], TypeError)


def test_ch12_batch_isolates_expected_task_errors():
    ns = load_example("12-project.py")

    def worker(task):
        if task["value"] < 0:
            raise ns["TaskError"]("negative")
        return task["value"] * 2

    result = ns["run_batch"](
        [{"id": "ok", "value": 4}, {"id": "bad", "value": -1}, {"id": "next", "value": 1}],
        worker,
    )
    assert result == [
        {"id": "ok", "value": 8},
        {"id": "bad", "error": "negative"},
        {"id": "next", "value": 2},
    ]
    with pytest.raises(KeyError):
        ns["run_batch"]([{"id": "x"}], worker)

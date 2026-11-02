import asyncio
import io
import json
from pathlib import Path
import pytest
from python.task_processor import Task, InputError, TransientError, PermanentError, Processor, load_tasks, parse_tasks
from python.task_processor.async_example import process_group


def test_parse_preserves_cause_and_validates_schema():
    with pytest.raises(InputError) as caught:
        parse_tasks("{")
    assert isinstance(caught.value.__cause__, json.JSONDecodeError)
    for text in ['{}', '[null]', '[{"id":"a","value":true}]', '[{"id":"a","value":1,"extra":2}]']:
        with pytest.raises(InputError):
            parse_tasks(text)
    assert parse_tasks('[{"id":"a","value":0}]') == [Task("a", 0)]


def test_file_cleanup_after_read_and_parse_failure(monkeypatch):
    stream = io.StringIO("{")
    monkeypatch.setattr(Path, "open", lambda *args, **kwargs: stream)
    with pytest.raises(InputError):
        load_tasks("unused.json")
    assert stream.closed


def test_file_errors_and_unicode_are_chained(tmp_path):
    with pytest.raises(InputError) as caught:
        load_tasks(tmp_path / "missing.json")
    assert isinstance(caught.value.__cause__, OSError)
    bad = tmp_path / "bad.json"
    bad.write_bytes(b"\xff")
    with pytest.raises(InputError) as caught:
        load_tasks(bad)
    assert isinstance(caught.value.__cause__, UnicodeError)


def test_retry_budget_backoff_and_success_commit():
    calls, delays = [], []
    def work(task):
        calls.append(task.id)
        if len(calls) < 4:
            raise TransientError("busy")
        return 12
    processor = Processor(work, max_attempts=4, base_delay=0.02, max_delay=0.03, sleep=delays.append)
    result = processor.process_one(Task("a", 6))
    assert result.value == 12 and result.attempts == 4
    assert delays == [0.02, 0.03, 0.03]
    assert processor.committed == {"a": 12}
    assert processor.process_one(Task("a", 6)).status == "cached"
    assert len(calls) == 4
    with pytest.raises(InputError, match="conflicting"):
        processor.process_one(Task("a", 7))


def test_failed_task_does_not_commit_and_batch_continues(caplog):
    calls = []
    def worker(task):
        calls.append(task.id)
        if task.id == "bad":
            raise TransientError("busy")
        return task.value * 2
    processor = Processor(worker, max_attempts=2, sleep=lambda _: None)
    results = processor.process_batch([Task("bad", 1), Task("good", 3)])
    assert [r.status for r in results] == ["failed", "done"]
    assert calls == ["bad", "bad", "good"]
    assert processor.committed == {"good": 6}
    diagnostic = next(record for record in caplog.records if record.exc_info)
    assert diagnostic.exc_info[0] is TransientError
    assert "exhausted 2" in diagnostic.exc_info[1].__notes__[0]


def test_unexpected_bug_and_control_flow_not_swallowed():
    for error in [TypeError("bug"), KeyboardInterrupt(), SystemExit(2)]:
        def fail(task):
            raise error
        processor = Processor(fail)
        with pytest.raises(type(error)):
            processor.process_batch([Task("a", 1)])
        assert processor.committed == {}


@pytest.mark.parametrize("attempts", [0, -1, True, 1.5])
def test_invalid_retry_budget(attempts):
    with pytest.raises(ValueError):
        Processor(max_attempts=attempts)


def test_async_success():
    async def worker(task):
        return task.value * 2
    assert asyncio.run(process_group([Task("a", 2), Task("b", 3)], worker)) == {"a": 4, "b": 6}


@pytest.mark.parametrize("second_value", [2, 3])
def test_async_duplicate_keys_rejected_before_work(second_value):
    async def worker(task):
        pytest.fail("duplicate keys must be rejected before execution")
    with pytest.raises(InputError, match="unique"):
        asyncio.run(process_group([Task("a", 2), Task("a", second_value)], worker))


def test_async_failure_cancels_peer_and_waits_for_cleanup():
    async def scenario():
        started, cleaned = asyncio.Event(), asyncio.Event()
        async def worker(task):
            if task.id == "waiting":
                try:
                    started.set()
                    await asyncio.Event().wait()
                finally:
                    cleaned.set()
            await started.wait()
            raise PermanentError("failed")
        with pytest.raises(ExceptionGroup) as caught:
            await process_group([Task("waiting", 1), Task("failing", 2)], worker)
        assert cleaned.is_set()
        assert len(caught.value.exceptions) == 1
        assert isinstance(caught.value.exceptions[0], PermanentError)
    asyncio.run(scenario())

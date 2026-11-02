"""Assert protocol boundaries, not just the generated JSON's shape."""
import json
import pytest
from pathlib import Path
from python.semantics.resources import generate, observe


def kinds(result):
    return [e['kind'] for e in result['events']]


def test_enter_must_succeed_before_body_and_exit():
    failure = observe('enter', fail=True)
    assert kinds(failure) == ['enter', 'failed', 'caught']
    assert failure['exits'] == []
    success = observe('enter')
    assert kinds(success) == ['enter', 'ready', 'body', 'tail', 'exit', 'continued']
    assert 'body resource:A' in success['output']


def test_exit_arguments_and_selective_suppression():
    for suppress in [False, True]:
        normal = observe('exit', suppress=suppress)
        args = normal['exits'][0]
        assert (args['type'], args['valueType'], args['traceback']) == (None, None, False)
        for body in ['ValueError', 'TypeError']:
            result = observe('exit', body, suppress=suppress)
            args = result['exits'][0]
            assert args['type'] == args['valueType'] == body
            assert args['message'] == 'work failed'
            assert args['traceback'] and args['sameException']
            assert 'tail' not in kinds(result)
            allowed = suppress and body == 'ValueError'
            assert args['result'] == allowed
            assert ('continued' in kinds(result)) == allowed
            assert ('caught' in kinds(result)) != allowed


def test_stack_registers_only_successful_entries_and_unwinds_in_reverse():
    for body in ['normal', 'ValueError']:
        result = observe('stack', body)
        assert [e['name'] for e in result['exits']] == ['B', 'A']
        assert [e['type'] for e in result['exits']] == ([None, None] if body == 'normal' else [body, body])
        assert result['events'][-1]['registered'] == []
    failure = observe('stack', fail=True)
    assert [e['name'] for e in failure['exits']] == ['A']
    assert failure['exits'][0]['type'] == 'OSError'
    assert 'body' not in kinds(failure)
    assert [e['text'] for e in failure['events'] if e['kind'] == 'register'] == ['register A']
    assert [e['registered'] for e in failure['events'] if e['kind'] == 'failed'] == [['A']]


def test_checked_in_data_matches_real_python():
    target = Path(__file__).resolve().parents[2] / 'src/data/resources.json'
    assert json.loads(target.read_text(encoding='utf-8')) == generate()


def test_exit_truthiness_cannot_cancel_return_and_exit_error_propagates():
    received = []
    class KeepReturn:
        def __enter__(self):
            return self
        def __exit__(self, kind, value, tb):
            received.append((kind, value, tb))
            return True
    def run():
        with KeepReturn():
            return 7
    assert run() == 7
    assert received == [(None, None, None)]

    class ExitFailure(KeepReturn):
        def __exit__(self, kind, value, tb):
            raise OSError("close failed")
    with pytest.raises(OSError, match="close failed") as caught:
        with ExitFailure():
            raise ValueError("work failed")
    assert isinstance(caught.value.__context__, ValueError)

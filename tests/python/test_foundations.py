import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'chapter01_foundations', ROOT / 'python/semantics/foundations.py')
FOUNDATIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FOUNDATIONS)
DATA = json.loads((ROOT / 'src/data/foundations.json').read_text(encoding='utf-8'))


@pytest.fixture(scope='session')
def generated():
    return FOUNDATIONS.generate()


def test_generated_data_matches_real_python(generated):
    assert generated == DATA


def test_phase_boundaries_show_compile_execute_and_completion(generated):
    phases = {row['id']: row for row in generated['phases']}
    assert phases['syntax']['compiled'] is False
    assert phases['syntax']['stage'] == 'compile'
    assert phases['syntax']['stdout'] == []
    assert phases['syntax']['error']['type'] == 'SyntaxError'
    assert phases['runtime']['compiled'] is True
    assert phases['runtime']['stage'] == 'execute'
    assert phases['runtime']['stdout'] == ['before']
    assert phases['runtime']['error']['type'] == 'ValueError'
    assert phases['valid']['compiled'] is True
    assert phases['valid']['stage'] == 'complete'
    assert phases['valid']['stdout'] == ['before', 'after 3']
    assert phases['valid']['error'] is None


def test_exception_objects_capture_real_args_and_keyerror_quotes(generated):
    objects = {row['id']: row for row in generated['objects']}
    assert [objects[key]['observation']['type'] for key in ('value', 'type', 'key')] == [
        'ValueError', 'TypeError', 'KeyError']
    assert objects['value']['observation']['argsRepr'] == (
        "(\"invalid literal for int() with base 10: 'pear'\",)")
    assert objects['type']['observation']['argsRepr'] == (
        """('can only concatenate str (not "int") to str',)""")
    assert objects['key']['observation']['message'] == "'missing'"
    assert objects['key']['observation']['argsRepr'] == "('missing',)"
    assert objects['key']['observation']['repr'] == "KeyError('missing')"
    for row in objects.values():
        assert row['stdout'] == [row['observation']['type'],
                                 row['observation']['message'],
                                 row['observation']['argsRepr']]


def test_traceback_contains_only_two_course_frames_and_real_source(generated):
    trace = generated['trace']
    assert trace['type'] == 'ValueError'
    assert [frame['name'] for frame in trace['frames']] == ['<module>', 'parse_count']
    assert len(trace['frames']) == 2
    for frame in trace['frames']:
        assert frame['source'] == trace['code'].splitlines()[frame['line'] - 1].strip()
    assert 'chapter01.py' in trace['formatted']
    assert 'Traceback (most recent call last)' in trace['formatted']

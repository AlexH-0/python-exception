import pytest
from python.semantics.contracts import CASES, DEFINITIONS, generate, observe


def test_swallowed_failure_is_indistinguishable_from_a_legitimate_zero():
    cases = {c['id']: c for c in CASES}
    failure = observe(cases['bad_json'], 'normal')
    assert failure['error']['type'] == 'TaskInputError'
    assert failure['cause']['type'] == 'JSONDecodeError'
    assert failure['expected'] and failure['field'] == 'document'
    assert observe(cases['bad_json'], 'counter') == observe(cases['zero'], 'normal')


def test_internal_bug_propagates_and_bool_is_rejected():
    cases = {c['id']: c for c in CASES}
    bug = observe(cases['bug'], 'normal')
    assert bug['error']['type'] == 'TypeError' and not bug['expected']
    assert observe(cases['bug'], 'counter')['value'] == 0
    assert observe(cases['boolean'], 'normal')['error']['type'] == 'TaskInputError'
    assert observe(cases['valid'], 'normal')['value'] == 42


def test_structured_attributes_survive_translation_and_validate_constructor():
    first, second = generate()['fields']
    assert first['message'] != second['message']
    assert first['action'] == second['action'] == 'highlight:value'
    assert first['field'] == second['field'] == 'value'
    namespace = {}
    exec(DEFINITIONS, namespace)
    with pytest.raises(ValueError):
        namespace['TaskInputError']('bad', task_id='', field='value')
    with pytest.raises(ValueError):
        namespace['TaskInputError']('bad', task_id='x', field='password')

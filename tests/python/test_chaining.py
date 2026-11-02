from python.semantics.chaining import generate

def test_hidden_display_keeps_context_and_explicit_cause_wins():
    cases = {c['id']: c for c in generate()['chains']}
    assert cases['hidden']['context']['type'] == 'ValueError'
    assert cases['hidden']['cause'] is None and cases['hidden']['suppressed']
    assert not any(line.startswith('ValueError:') for line in cases['hidden']['display'])
    assert any(line.startswith('ValueError:') for line in cases['explicit']['display'])
    assert cases['explicit']['cause']['type'] == 'ValueError'
    assert cases['implicit']['cause'] is None and not cases['implicit']['suppressed']

def test_named_raise_preserves_identity_but_adds_location():
    cases = {c['id']: c for c in generate()['reraises']}
    assert cases['bare']['sameObject'] and cases['named']['sameObject']
    assert len(cases['named']['frames']) == len(cases['bare']['frames']) + 1
    assert not cases['translate']['sameObject']
    assert cases['translate']['cause']['type'] == 'ValueError'

def test_notes_preserve_type_and_message():
    for case in generate()['notes']:
        assert case['type'] == 'ValueError' and case['message'] == 'invalid count'
        assert case['argsUnchanged']
        assert len(case['notes']) == int(case['id']).bit_count()

from python.semantics.hierarchy import generate


def test_cpython_hierarchy_matches_expected_boundaries():
    data = generate()
    m = data['matches']
    assert m['LookupError']['KeyError'] and m['LookupError']['IndexError']
    assert not m['LookupError']['ValueError']
    assert m['OSError']['FileNotFoundError'] and m['OSError']['PermissionError']
    for name in ('KeyboardInterrupt', 'SystemExit', 'GeneratorExit'):
        assert m['BaseException'][name] and not m['Exception'][name]
    assert all(m['Exception'][name] for name in ('ValueError', 'TypeError', 'OSError'))

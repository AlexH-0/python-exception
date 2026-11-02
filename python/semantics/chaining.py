"""Generate finite, real Python examples for the exception-chain lesson."""
import argparse
import json
import platform
import traceback
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / 'src/data/chaining.json'

def describe(error):
    return None if error is None else {'type': type(error).__name__, 'message': str(error)}

def chain_case(mode):
    suffix = {'implicit': '', 'explicit': ' from original', 'hidden': ' from None'}[mode]
    code = ('class InputError(Exception):\n    pass\n\ndef convert():\n'
            '    try:\n        int("bad")\n    except ValueError as original:\n'
            '        raise InputError("count must be an integer")' + suffix)
    namespace = {}
    exec(compile(code, '<chain-example>', 'exec'), namespace)
    try:
        namespace['convert']()
    except Exception as error:
        formatted = ''.join(traceback.format_exception(error))
        # Keep actual default-display exception summaries, omit frames and host paths.
        summaries = [line.strip() for line in formatted.splitlines()
                     if line.startswith(('ValueError:', 'InputError:', 'The above exception', 'During handling'))]
        return {'id': mode, 'code': code, 'outer': describe(error),
                'cause': describe(error.__cause__), 'context': describe(error.__context__),
                'suppressed': error.__suppress_context__, 'display': summaries}

def reraise_case(mode):
    action = {'bare': 'raise', 'named': 'raise error', 'translate': 'raise InputError("invalid count") from error'}[mode]
    code = ('class InputError(Exception):\n    pass\n\ndef parse():\n'
            '    global original_seen\n    try:\n        int("bad")\n'
            '    except ValueError as error:\n        original_seen = error\n        ' + action)
    namespace = {}
    exec(compile(code, '<reraise-example>', 'exec'), namespace)
    try:
        namespace['parse']()
    except Exception as error:
        return {'id': mode, 'code': code, 'action': action, 'outer': describe(error),
                'sameObject': error is namespace['original_seen'],
                'cause': describe(error.__cause__),
                'frames': [{'line': f.lineno, 'code': code.splitlines()[f.lineno - 1].strip()}
                           for f in traceback.extract_tb(error.__traceback__) if f.name == 'parse']}

def note_case(mask):
    error = ValueError('invalid count')
    before_args = error.args
    for bit, note in [(1, 'field=count'), (2, 'task id=7')]:
        if mask & bit:
            error.add_note(note)
    return {'id': str(mask), 'type': type(error).__name__, 'message': str(error),
            'notes': getattr(error, '__notes__', []), 'argsUnchanged': before_args == error.args,
            'display': ''.join(traceback.format_exception_only(error)).strip()}

def generate():
    return {'pythonVersion': platform.python_version(),
            'chains': [chain_case(m) for m in ('implicit', 'explicit', 'hidden')],
            'reraises': [reraise_case(m) for m in ('bare', 'named', 'translate')],
            'notes': [note_case(m) for m in range(4)]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    actual = generate()
    if args.check:
        assert json.loads(TARGET.read_text(encoding='utf-8')) == actual, 'Chaining data differs from real Python'
        print('Verified chain, rethrow and note examples')
    else:
        TARGET.write_text(json.dumps(actual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('Generated chain, rethrow and note examples')

if __name__ == '__main__':
    main()

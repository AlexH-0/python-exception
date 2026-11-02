"""Finite, executable evidence for chapter 01 Python foundations."""
import argparse
import contextlib
import io
import json
import linecache
import platform
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / 'src/data/foundations.json'

PHASE_CODES = {
    'syntax': "print('before')\nif True print('broken')\nprint('after')\n",
    'runtime': "print('before')\nnumber = int('pear')\nprint('after', number)\n",
    'valid': "print('before')\nnumber = int('3')\nprint('after', number)\n",
}

OBJECT_CODES = {
    'value': "try:\n    int('pear')\nexcept Exception as err:\n    observation = {\n        'type': type(err).__name__,\n        'message': str(err),\n        'argsRepr': repr(err.args),\n        'repr': repr(err),\n    }\n    print(observation['type'])\n    print(observation['message'])\n    print(observation['argsRepr'])\n",
    'type': "try:\n    '3' + 1\nexcept Exception as err:\n    observation = {\n        'type': type(err).__name__,\n        'message': str(err),\n        'argsRepr': repr(err.args),\n        'repr': repr(err),\n    }\n    print(observation['type'])\n    print(observation['message'])\n    print(observation['argsRepr'])\n",
    'key': "try:\n    {'count': 3}['missing']\nexcept Exception as err:\n    observation = {\n        'type': type(err).__name__,\n        'message': str(err),\n        'argsRepr': repr(err.args),\n        'repr': repr(err),\n    }\n    print(observation['type'])\n    print(observation['message'])\n    print(observation['argsRepr'])\n",
}

TRACE_CODE = '''import traceback

def parse_count(text):
    return int(text)

try:
    parse_count('pear')
except ValueError as err:
    observation = {
        'type': type(err).__name__,
        'message': str(err),
        'frames': [
            {'name': frame.name, 'line': frame.lineno, 'source': frame.line}
            for frame in traceback.extract_tb(err.__traceback__)
            if frame.filename == 'chapter01.py'
        ],
        'formatted': ''.join(traceback.format_exception(err)),
    }
'''


def _execute(code, filename='<lesson>'):
    output = io.StringIO()
    namespace = {}
    compiled = False
    try:
        program = compile(code, filename, 'exec')
        compiled = True
    except Exception as error:
        return {'compiled': False, 'stdout': [], 'stage': 'compile',
                'error': {'type': type(error).__name__, 'message': str(error),
                          'argsRepr': repr(error.args)}}
    try:
        with contextlib.redirect_stdout(output):
            exec(program, namespace)
    except Exception as error:
        return {'compiled': compiled, 'stdout': output.getvalue().splitlines(),
                'stage': 'execute',
                'error': {'type': type(error).__name__, 'message': str(error),
                          'argsRepr': repr(error.args)}}
    return {'compiled': compiled, 'stdout': output.getvalue().splitlines(),
            'stage': 'complete', 'error': None}


def _trace():
    filename = 'chapter01.py'
    missing = object()
    previous = linecache.cache.get(filename, missing)
    linecache.cache[filename] = (len(TRACE_CODE), None,
                                 TRACE_CODE.splitlines(True), filename)
    try:
        namespace = {}
        program = compile(TRACE_CODE, filename, 'exec')
        exec(program, namespace)
        return {'code': TRACE_CODE, **namespace['observation']}
    finally:
        if previous is missing:
            linecache.cache.pop(filename, None)
        else:
            linecache.cache[filename] = previous


def _object(code):
    namespace = {}
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(compile(code, '<object-lesson>', 'exec'), namespace)
    operations = {'value': "int('pear')", 'type': "'3' + 1",
                  'key': "{'count': 3}['missing']"}
    key = next(key for key, source in OBJECT_CODES.items() if source == code)
    return {'code': code, 'operation': operations[key],
            'observation': namespace['observation'],
            'stdout': output.getvalue().splitlines()}


def generate():
    return {
        'pythonVersion': platform.python_version(),
        'phases': [
            {'id': key, 'label': label, 'code': PHASE_CODES[key],
             **_execute(PHASE_CODES[key], 'chapter01.py')}
            for key, label in [('syntax', '语法写错'), ('runtime', '运行时失败'),
                               ('valid', '正常完成')]],
        'objects': [
            {'id': key, 'label': label, **_object(OBJECT_CODES[key])}
            for key, label in [('value', 'ValueError'), ('type', 'TypeError'),
                               ('key', 'KeyError')]],
        'trace': _trace(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = generate()
    if args.check:
        if json.loads(TARGET.read_text(encoding='utf-8')) != data:
            raise SystemExit('foundations.json differs from generated evidence')
        print('Verified chapter 01 phases, exception objects, and traceback')
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                          encoding='utf-8')
        print('Generated chapter 01 foundations evidence')


if __name__ == '__main__':
    main()

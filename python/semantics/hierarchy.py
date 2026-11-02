"""Generate the finite teaching subset from CPython 3.11."""
import argparse
import builtins
import json
from pathlib import Path
import sys

NAMES = ('BaseException', 'Exception', 'KeyboardInterrupt', 'SystemExit', 'GeneratorExit', 'ValueError', 'TypeError', 'LookupError', 'KeyError', 'IndexError', 'OSError', 'FileNotFoundError', 'PermissionError', 'ArithmeticError', 'ZeroDivisionError')
OUTPUT = Path(__file__).resolve().parents[2] / 'src' / 'data' / 'hierarchy.json'

def generate():
    if sys.version_info[:2] != (3, 11) or sys.implementation.name != 'cpython':
        raise RuntimeError('Use CPython 3.11 to generate this teaching data')
    classes = {name: getattr(builtins, name) for name in NAMES}
    return {'python': 'CPython 3.11', 'types': [{'name': name, 'bases': [base.__name__ for base in cls.__bases__ if base.__name__ in classes]} for name, cls in classes.items()], 'matches': {handler: {name: issubclass(cls, parent) for name, cls in classes.items()} for handler, parent in classes.items()}}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = json.dumps(generate(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != data:
            raise SystemExit('hierarchy.json differs; regenerate it')
        print('hierarchy.json is up to date')
    else:
        OUTPUT.write_text(data, encoding='utf-8', newline='\n')
        print('generated', OUTPUT)

if __name__ == '__main__':
    main()

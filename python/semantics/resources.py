"""Finite, executable evidence for the chapter 08 resource lessons."""
import argparse
import contextlib
import io
import json
import platform
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / 'src/data/resources.json'

DEFINITIONS = '''from contextlib import ExitStack

events, exits, registered = [], [], []

def emit(kind, text):
    events.append({"kind": kind, "text": text,
                   "registered": registered.copy()})
    print(text)

class Resource:
    def __init__(self, name, *, fail=False, suppress=False):
        self.name, self.fail, self.suppress = name, fail, suppress

    def __enter__(self):
        emit("enter", f"enter {self.name}")
        if self.fail:
            emit("failed", f"enter failed {self.name}")
            raise OSError("cannot acquire " + self.name)
        emit("ready", f"ready {self.name}")
        return "resource:" + self.name

    def __exit__(self, kind, value, tb):
        result = self.suppress and kind is ValueError
        exits.append({"name": self.name,
                      "type": kind.__name__ if kind else None,
                      "valueType": type(value).__name__ if value is not None else None,
                      "message": str(value) if value is not None else None,
                      "traceback": tb is not None,
                      "sameException": value is not None and kind is type(value),
                      "result": result})
        if self.name in registered:
            registered.remove(self.name)
        emit("exit", f"exit {self.name}: {kind.__name__ if kind else 'None'}")
        return result
'''


def source_for(group, body='normal', suppress=False, fail=False):
    if group == 'stack':
        lines = ['with ExitStack() as stack:',
                 '    first = stack.enter_context(',
                 '        Resource("A"))',
                 '    registered.append("A")',
                 '    emit("register", "register A")',
                 '    second = stack.enter_context(',
                 f'        Resource("B", fail={fail}))',
                 '    registered.append("B")',
                 '    emit("register", "register B")',
                 '    emit("body", "body")']
    else:
        lines = ['with Resource(',
                 f'    "A", fail={fail}, suppress={suppress}',
                 ') as value:',
                 '    emit("body", "body " + value)']
    if body != 'normal':
        lines.append(f'    raise {body}("work failed")')
    lines += ['    emit("tail", "body tail")', 'emit("continued", "after with")']
    return DEFINITIONS + '\ntry:\n' + ''.join('    ' + line + '\n' for line in lines) + '''except Exception as error:
    emit("caught", "outer caught " + type(error).__name__)
'''


def observe(group, body='normal', suppress=False, fail=False):
    code = source_for(group, body, suppress, fail)
    namespace = {}
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(compile(code, '<resource-lesson>', 'exec'), namespace)
    return {'code': code, 'output': output.getvalue().splitlines(),
            'events': namespace['events'], 'exits': namespace['exits']}


def generate():
    return {'pythonVersion': platform.python_version(),
            'enter': [{'id': 'success', 'label': '进入成功', **observe('enter')},
                      {'id': 'failure', 'label': '进入失败', **observe('enter', fail=True)}],
            'exit': [{'id': body, 'label': label,
                      'propagate': observe('exit', body),
                      'selective': observe('exit', body, suppress=True)}
                     for body, label in [('normal', '正常完成'), ('ValueError', '抛 ValueError'), ('TypeError', '抛 TypeError')]],
            'stack': [{'id': 'normal', 'label': '两个资源都成功', **observe('stack')},
                      {'id': 'enter-fail', 'label': 'B 进入失败', **observe('stack', fail=True)},
                      {'id': 'body-fail', 'label': '使用时失败', **observe('stack', 'ValueError')}]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = generate()
    if args.check:
        assert json.loads(TARGET.read_text(encoding='utf-8')) == data
        print('Verified 11 resource outcomes')
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('Generated chapter 08 resource evidence')


if __name__ == '__main__':
    main()

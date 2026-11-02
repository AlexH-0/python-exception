"""Finite Python evidence for chapter 07: contracts and swallowed failures."""
import argparse
import json
import platform
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / 'src/data/contracts.json'
DEFINITIONS = '''import json

class TaskError(Exception):
    pass

class TaskInputError(TaskError):
    def __init__(self, message, *, task_id, field):
        if not isinstance(task_id, str) or not task_id:
            raise ValueError("task_id must be a non-empty string")
        if field not in {"document", "value"}:
            raise ValueError("unknown field")
        super().__init__(message)
        self.task_id = task_id
        self.field = field

def load_value(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError as original:
        raise TaskInputError("invalid task JSON",
            task_id="task-7", field="document") from original
    if not isinstance(data, dict) or set(data) != {"value"}:
        raise TaskInputError("expected exactly value",
            task_id="task-7", field="document")
    if type(data["value"]) is not int:
        raise TaskInputError("value must be an integer",
            task_id="task-7", field="value")
    return data["value"]

def run_job(text, *, bug=False):
    value = load_value(text)
    if bug:  # 固定教学案例：内部代码写错。
        return value + "units"
    return value * 2
'''
WRAPPERS = {
    'normal': '''def submit(text, *, bug=False):
    return run_job(text, bug=bug)
''',
    'counter': '''def submit(text, *, bug=False):
    try:
        return run_job(text, bug=bug)
    except Exception:
        return 0  # 错误：用成功值代替失败。
'''
}
CASES = [
    {'id': 'valid', 'label': '整数 21', 'text': '{"value":21}', 'bug': False},
    {'id': 'zero', 'label': '合法的 0', 'text': '{"value":0}', 'bug': False},
    {'id': 'bad_json', 'label': '损坏的 JSON', 'text': '{', 'bug': False},
    {'id': 'boolean', 'label': '把 true 当整数', 'text': '{"value":true}', 'bug': False},
    {'id': 'bug', 'label': '内部代码写错', 'text': '{"value":21}', 'bug': True},
]

def describe(error):
    if error is None:
        return None
    return {'type': type(error).__name__, 'message': str(error)}

def observe(case, mode):
    namespace = {}
    exec(compile(DEFINITIONS + '\n' + WRAPPERS[mode], '<contract-example>', 'exec'), namespace)
    try:
        value = namespace['submit'](case['text'], bug=case['bug'])
    except Exception as error:
        return {'kind': 'raised', 'value': None, 'error': describe(error),
                'cause': describe(error.__cause__), 'taskId': getattr(error, 'task_id', None),
                'field': getattr(error, 'field', None),
                'expected': isinstance(error, namespace['TaskError'])}
    return {'kind': 'returned', 'value': value, 'error': None, 'cause': None,
            'taskId': None, 'field': None, 'expected': False}

def generate():
    namespace = {}
    exec(DEFINITIONS, namespace)
    fields = []
    for message in ['value must be an integer', 'value 必须是整数']:
        error = namespace['TaskInputError'](message, task_id='task-7', field='value')
        fields.append({'message': str(error), 'args': list(error.args),
                       'type': type(error).__name__, 'taskId': error.task_id, 'field': error.field,
                       'action': 'highlight:' + error.field})
    return {'pythonVersion': platform.python_version(), 'definitions': DEFINITIONS,
            'wrappers': WRAPPERS, 'fields': fields,
            'cases': [{**case, 'normal': observe(case, 'normal'), 'counter': observe(case, 'counter')}
                      for case in CASES]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = generate()
    if args.check:
        assert json.loads(TARGET.read_text(encoding='utf-8')) == data
        print('Verified 10 contract outcomes and 2 structured-message examples')
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('Generated chapter 07 contract evidence')

if __name__ == '__main__':
    main()

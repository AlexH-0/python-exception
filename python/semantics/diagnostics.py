"""Finite executable evidence for chapter 09 diagnostics, logging, and pytest."""
import argparse
import json
import logging
import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / 'src/data/diagnostics.json'

TRACE_CODE = '''def convert(text):
    return int(text)

def parse_record(record):
    return convert(record)

def run_job():
    return parse_record("bad")

run_job()
'''

LOG_CODES = {
    'message': '''try:
    int("bad")
except ValueError as error:
    logger.error("task_id=%s phase=%s error=%s", "job-9", "parse", error)
after_handler = True
''',
    'traceback': '''try:
    int("bad")
except ValueError as error:
    logger.exception("task_id=%s phase=%s parse failed", "job-9", "parse")
after_handler = True
''',
    'reraise': '''try:
    int("bad")
except ValueError as error:
    logger.exception("task_id=%s phase=%s parse failed", "job-9", "parse")
    raise
after_handler = True
''',
}

DEFINITION = '''class TaskInputError(Exception):
    def __init__(self, task_id, message="invalid count"):
        self.task_id = task_id
        super().__init__(message)
'''

IMPLEMENTATIONS = {
    'correct': '''def read_count(task_id, text):
    if not isinstance(text, str):
        raise TaskInputError(task_id, "count must be text")
    try:
        return int(text)
    except ValueError as original:
        raise TaskInputError(task_id, "count must be an integer") from original
''',
    'bool-bug': '''def read_count(task_id, text):
    try:
        return int(text)
    except ValueError as original:
        raise TaskInputError(task_id, "count must be an integer") from original
''',
    'cause-bug': '''def read_count(task_id, text):
    if not isinstance(text, str):
        raise TaskInputError(task_id, "count must be text")
    try:
        return int(text)
    except ValueError:
        raise TaskInputError(task_id, "count must be an integer") from None
''',
}

SUITES = {
    'success': '''import pytest

def test_valid_count():
    assert read_count("job-9", "21") == 21
''',
    'type': '''import pytest

def test_bad_text_raises_domain_error():
    with pytest.raises(TaskInputError):
        read_count("job-9", "bad")
''',
    'contract': '''import pytest

def test_success():
    assert read_count("job-9", "21") == 21

def test_bad_text_keeps_task_and_cause():
    with pytest.raises(TaskInputError) as captured:
        read_count("job-9", "bad")
    assert captured.value.task_id == "job-9"
    assert isinstance(captured.value.__cause__, ValueError)

def test_bool_is_rejected():
    with pytest.raises(TaskInputError) as captured:
        read_count("job-9", True)
    assert captured.value.task_id == "job-9"
''',
}


def _frames(tb, filename):
    found = []
    while tb is not None:
        frame = tb.tb_frame
        if frame.f_code.co_filename == filename:
            found.append({'function': frame.f_code.co_name,
                          'line': tb.tb_lineno,
                          'source': _source_line(frame.f_code, tb.tb_lineno)})
        tb = tb.tb_next
    return found


def _source_line(code, line):
    import linecache
    return linecache.getline(code.co_filename, line).strip()


def _trace():
    filename = 'chapter09.py'
    import linecache
    missing = object()
    previous_source = linecache.cache.get(filename, missing)
    linecache.cache[filename] = (len(TRACE_CODE), None, TRACE_CODE.splitlines(True), filename)
    try:
        namespace = {}
        try:
            exec(compile(TRACE_CODE, filename, 'exec'), namespace)
        except ValueError as error:
            frames = _frames(error.__traceback__, filename)
            return {'code': TRACE_CODE, 'type': type(error).__name__,
                    'message': str(error), 'frames': frames}
        raise RuntimeError('diagnostic trace unexpectedly succeeded')
    finally:
        if previous_source is missing:
            linecache.cache.pop(filename, None)
        else:
            linecache.cache[filename] = previous_source


def _log_case(case_id):
    import linecache
    code = LOG_CODES[case_id]
    filename = 'chapter09.py'
    missing = object()
    previous_source = linecache.cache.get(filename, missing)
    linecache.cache[filename] = (len(code), None, code.splitlines(True), filename)
    logger = logging.getLogger('chapter09.diagnostics.' + case_id)
    previous_handlers = logger.handlers[:]
    previous_level, previous_propagate = logger.level, logger.propagate
    previous_disabled = logger.disabled
    previous_filters = logger.filters[:]
    captured = []

    class Capture(logging.Handler):
        def emit(self, record):
            rendered = self.format(record)
            tb = record.exc_info[2] if record.exc_info else None
            captured.append((record, rendered,
                             _frames(tb, filename) if tb is not None else []))

    handler = Capture()
    handler.setFormatter(logging.Formatter('%(levelname)s:%(message)s'))
    try:
        logger.handlers = [handler]
        logger.filters = []
        logger.setLevel(logging.ERROR)
        logger.disabled = False
        logger.propagate = False
        namespace = {'logger': logger, 'after_handler': False}
        propagated = False
        try:
            exec(compile(LOG_CODES[case_id], filename, 'exec'), namespace)
        except ValueError:
            propagated = True
        if len(captured) != 1:
            raise RuntimeError('expected exactly one captured log record')
        record, formatted, frames = captured[0]
        return {'id': case_id,
                'label': {'message': '只记录错误消息', 'traceback': '记录异常现场',
                          'reraise': '记录后重新抛出'}[case_id],
                'code': LOG_CODES[case_id], 'message': record.getMessage(),
                'formatted': formatted, 'hasExcInfo': record.exc_info is not None,
                'exceptionType': record.exc_info[0].__name__ if record.exc_info else None,
                'frames': frames, 'propagated': propagated,
                'afterHandler': namespace['after_handler']}
    finally:
        handler.close()
        logger.handlers = previous_handlers
        logger.filters = previous_filters
        logger.setLevel(previous_level)
        logger.disabled = previous_disabled
        logger.propagate = previous_propagate
        if previous_source is missing:
            linecache.cache.pop(filename, None)
        else:
            linecache.cache[filename] = previous_source


def _run_pytest(implementation, suite):
    source = DEFINITION + '\n' + IMPLEMENTATIONS[implementation] + '\n' + SUITES[suite]
    with tempfile.TemporaryDirectory(prefix='chapter09-pytest-') as directory:
        test_file = Path(directory) / 'test_chapter09.py'
        test_file.write_text(source, encoding='utf-8')
        environment = os.environ.copy()
        environment['PYTEST_DISABLE_PLUGIN_AUTOLOAD'] = '1'
        completed = subprocess.run(
            [sys.executable, '-m', 'pytest', '-q', '-p', 'no:cacheprovider',
             '--color=no', str(test_file)], cwd=directory, env=environment,
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
        if completed.returncode not in (0, 1):
            raise RuntimeError('pytest execution error: ' + completed.stdout)
        summary_lines = [line for line in completed.stdout.splitlines()
                         if re.search(r'\b\d+ (?:passed|failed|error|errors)\b', line)]
        if not summary_lines or re.search(r'\b(?:error|errors)\b', summary_lines[-1]):
            raise RuntimeError('pytest collection or summary error: ' + completed.stdout)
        summary = summary_lines[-1]
        passed_match = re.search(r'(\d+) passed', summary)
        failed_match = re.search(r'(\d+) failed', summary)
        passed = int(passed_match.group(1)) if passed_match else 0
        failed = int(failed_match.group(1)) if failed_match else 0
        if passed + failed == 0 or completed.returncode != (1 if failed else 0):
            raise RuntimeError('unexpected pytest result: ' + completed.stdout)
        return {'implementation': implementation, 'suite': suite,
                'passed': passed, 'failed': failed,
                'exitCode': completed.returncode}


def generate():
    pytest_version = subprocess.run([sys.executable, '-m', 'pytest', '--version'],
                                    text=True, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, check=True).stdout.strip()
    return {
        'pythonVersion': platform.python_version(),
        'pytestVersion': pytest_version.removeprefix('pytest '),
        'trace': _trace(),
        'logs': [_log_case(case) for case in ('message', 'traceback', 'reraise')],
        'testing': {
            'definition': DEFINITION,
            'implementations': [
                {'id': key, 'label': label, 'code': IMPLEMENTATIONS[key]}
                for key, label in [('correct', '正确实现'), ('bool-bug', '遗漏 bool 类型检查'),
                                   ('cause-bug', '丢失显式异常原因')]],
            'suites': [
                {'id': key, 'label': label, 'code': SUITES[key]}
                for key, label in [('success', '合法输入'), ('type', '领域异常类型'),
                                   ('contract', '完整契约')]],
            'results': [_run_pytest(implementation, suite)
                        for implementation in ('correct', 'bool-bug', 'cause-bug')
                        for suite in ('success', 'type', 'contract')],
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = generate()
    if args.check:
        if json.loads(TARGET.read_text(encoding='utf-8')) != data:
            raise SystemExit('diagnostics.json differs from generated evidence')
        print('Verified diagnostics trace, logs, and 9 real pytest combinations')
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                          encoding='utf-8')
        print('Generated chapter 09 diagnostics evidence (9 real pytest combinations)')


if __name__ == '__main__':
    main()


"""Generate finite, real Python evidence for chapter 10 reliability lessons."""
import argparse
import contextlib
import io
import json
import platform
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from python.solutions.ch10 import retry
from python.task_processor import PermanentError, TransientError

TARGET = ROOT / "src/data/reliability.json"
RETRY_SOURCE = (ROOT / "python/solutions/ch10.py").read_text(encoding="utf-8")


def retry_code(profile, limit):
    """Return a complete root-runnable script and observe it by executing it."""
    operation = {
        "third-success": '''
    if len(attempts) < 2:
        error = TransientError("temporary worker failure")
        operation_errors.append(error)
        attempts.append({"number": len(attempts) + 1,
                         "outcome": "TransientError",
                         "delayAfter": None})
        raise error
    attempts.append({"number": len(attempts) + 1,
                     "outcome": "returned", "delayAfter": None})
    return 42
''',
        "always-transient": '''
    error = TransientError("temporary worker failure")
    operation_errors.append(error)
    attempts.append({"number": len(attempts) + 1,
                     "outcome": "TransientError",
                     "delayAfter": None})
    raise error
''',
        "permanent": '''
    error = PermanentError("task is permanently rejected")
    operation_errors.append(error)
    attempts.append({"number": len(attempts) + 1,
                     "outcome": "PermanentError",
                     "delayAfter": None})
    raise error
''',
        "bug": '''
    error = TypeError("worker returned an invalid shape")
    operation_errors.append(error)
    attempts.append({"number": len(attempts) + 1,
                     "outcome": "TypeError",
                     "delayAfter": None})
    raise error
''',
    }[profile]
    return f'''import json
from python.solutions.ch10 import retry
from python.task_processor import PermanentError, TransientError

attempts = []
delays = []
operation_errors = []

def record_sleep(seconds):
    delays.append(seconds)
    attempts[-1]["delayAfter"] = seconds

def operation():
{operation.rstrip()}

kind, value, error, same_last_exception = "returned", None, None, False
try:
    value = retry(operation, attempts={limit}, sleep=record_sleep)
except (TransientError, PermanentError, TypeError) as caught:
    kind = "raised"
    error = type(caught).__name__
    same_last_exception = bool(operation_errors) and caught is operation_errors[-1]

observation = {{"attempts": attempts, "delays": delays, "kind": kind,
               "value": value, "error": error,
               "sameLastException": same_last_exception}}
print(json.dumps(observation, ensure_ascii=False))
'''


RETRY_PROFILES = [
    ("third-success", "前两次暂时失败，第三次返回 42"),
    ("always-transient", "每次都是暂时失败"),
    ("permanent", "永久失败，第一次就传播"),
    ("bug", "TypeError 不属于可重试故障"),
]


def execute(code):
    namespace = {"__name__": "__main__"}
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(compile(code, "<chapter10-reliability>", "exec"), namespace)
    return json.loads(output.getvalue())


def make_retry_plans():
    rows = []
    for profile, label in RETRY_PROFILES:
        plans = []
        for limit in (2, 3):
            code = retry_code(profile, limit)
            plans.append({"limit": limit, **execute(code), "code": code})
        rows.append({"id": profile, "label": label, "plans": plans})
    return rows


def delivery_code(strategy):
    key_logic = {
        "append": '''
    key = "append-" + str(calls)
    effects.append({"key": key, "value": value})
''',
        "stable-key": '''
    key = "job-10"
    accept(key, value)
''',
        "new-key": '''
    key = "job-10-" + str(calls)
    accept(key, value)
''',
    }[strategy]
    dedup = strategy != "append"
    return f'''import json
from python.solutions.ch10 import retry
from python.task_processor import PermanentError, TransientError

effects, events, cache, delays = [], [], {{}}, []
calls = 0
deduplicate = {dedup!r}

def accept(key, value):
    previous = cache.get(key)
    if previous is not None:
        if previous != value:
            raise PermanentError("conflicting payload for key: " + key)
        events.append("duplicate accepted " + key)
        return
    effects.append({{"key": key, "value": value}})
    cache[key] = value

def receive(value):
    global calls
    calls += 1
    events.append("call " + str(calls))
{key_logic.rstrip()}
    if calls == 1:
        events.append("effect recorded; confirmation lost")
        raise TransientError("confirmation was lost")
    events.append("confirmation received")
    return "confirmed"

def record_sleep(seconds):
    delays.append(seconds)
    events.append("sleep " + str(seconds))

result = retry(lambda: receive(1), attempts=2, sleep=record_sleep)
conflict_rejected = False
if deduplicate:
    existing_key = next(iter(cache))
    try:
        accept(existing_key, 2)
    except PermanentError:
        conflict_rejected = True
        events.append("same key with different payload rejected")
observation = {{"calls": calls, "effects": effects, "events": events,
               "delays": delays, "conflictRejected": conflict_rejected,
               "kind": "returned", "error": None}}
print(json.dumps(observation, ensure_ascii=False))
'''


DELIVERY = [
    ("append", "每次调用都追加"),
    ("stable-key", "稳定键与相同负载"),
    ("new-key", "每次重试都换键"),
]


def make_delivery():
    rows = []
    for ident, label in DELIVERY:
        code = delivery_code(ident)
        observation = execute(code)
        rows.append({"id": ident, "label": label,
                     "code": code,
                     "calls": observation["calls"],
                     "effects": observation["effects"],
                     "events": observation["events"],
                     "kind": observation["kind"],
                     "error": observation["error"]})
    return rows


def partial_code(strategy):
    save_condition = strategy != "restart"
    always_fails = strategy == "still-fails"
    return f'''import json
from python.solutions.ch10 import retry
from python.task_processor import TransientError

writes = 0
notify_attempts = 0
notified = False
checkpoint = False
events = []
snapshots = []

def snapshot(ident):
    snapshots.append({{"id": ident, "writes": writes,
                      "notifyAttempts": notify_attempts,
                      "notified": notified}})

def save():
    global writes, checkpoint
    writes += 1
    events.append("save")
    if {save_condition!r}:
        checkpoint = True

def save_then_notify():
    global notify_attempts, notified
    if not checkpoint:
        save()
    notify_attempts += 1
    events.append("notify " + str(notify_attempts))
    if {always_fails!r} or notify_attempts == 1:
        events.append("notification failed")
        raise TransientError("notification unavailable")
    notified = True
    events.append("notification sent")
    return "done"

def operation():
    try:
        return save_then_notify()
    except TransientError:
        if notify_attempts == 1:
            snapshot("failure")
        raise

kind, error = "returned", None
try:
    retry(operation, attempts=2, sleep=lambda seconds: None)
except TransientError as caught:
    kind = "raised"
    error = type(caught).__name__
snapshot("final")
observation = {{"snapshots": snapshots, "events": events,
               "kind": kind, "error": error}}
print(json.dumps(observation, ensure_ascii=False))
'''


PARTIAL = [
    ("restart", "失败后从保存步骤重跑"),
    ("resume", "记录检查点后跳过已完成保存"),
    ("still-fails", "恢复通知但通知持续失败"),
]


def make_partial():
    rows = []
    for ident, label in PARTIAL:
        code = partial_code(ident)
        observation = execute(code)
        rows.append({"id": ident, "label": label, "code": code,
                     **observation})
    return rows


def generate():
    return {"pythonVersion": platform.python_version(),
            "retryCode": RETRY_SOURCE,
            "retries": make_retry_plans(),
            "delivery": make_delivery(),
            "partial": make_partial()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = generate()
    if args.check:
        assert json.loads(TARGET.read_text(encoding="utf-8")) == data
        print("Verified chapter 10 reliability evidence")
    else:
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
        print("Generated chapter 10 reliability evidence")


if __name__ == "__main__":
    main()

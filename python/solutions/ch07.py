from python.task_processor import Task, InputError


def validate_task(data):
    if not isinstance(data, dict) or set(data) != {"id", "value"}:
        raise InputError("expected exactly id and value")
    return Task(data["id"], data["value"])

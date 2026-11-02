class TaskError(Exception):
    pass


def run_batch(tasks, worker):
    results = []
    for task in tasks:
        try:
            value = worker(task)
        except TaskError as exc:
            results.append({"id": task["id"], "error": str(exc)})
        else:
            results.append({"id": task["id"], "value": value})
    return results


if __name__ == "__main__":
    def worker(task):
        if task["value"] < 0:
            raise TaskError("value must be non-negative")
        return task["value"] * 2

    print(run_batch([{"id": "a", "value": 2}, {"id": "b", "value": -1}], worker))

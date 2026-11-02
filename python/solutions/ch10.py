from time import sleep as real_sleep
from python.task_processor import TransientError


def retry(operation, attempts=3, sleep=real_sleep):
    if type(attempts) is not int or attempts < 1:
        raise ValueError("attempts must be a positive integer")
    for attempt in range(attempts):
        try:
            return operation()
        except TransientError:
            if attempt + 1 == attempts:
                raise
            sleep(0.01 * 2 ** attempt)

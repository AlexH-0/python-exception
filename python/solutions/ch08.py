from contextlib import contextmanager


@contextmanager
def managed(events, suppress=False):
    events.append("open")
    try:
        yield "resource"
    except ValueError:
        if not suppress:
            raise
    finally:
        events.append("close")

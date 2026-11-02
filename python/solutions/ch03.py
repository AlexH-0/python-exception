def compute(events, fail=False):
    try:
        events.append("work")
        if fail:
            raise ValueError("failed")
        return 2
    finally:
        events.append("cleanup")

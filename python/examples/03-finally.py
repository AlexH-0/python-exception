def compute(events, fail=False):
    try:
        events.append("work")
        if fail:
            raise ValueError("failed")
        return 2
    finally:
        events.append("cleanup")


if __name__ == "__main__":
    events = []
    print(compute(events), events)

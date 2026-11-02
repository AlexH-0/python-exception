class Managed:
    def __init__(self, events, suppress=False):
        self.events = events
        self.suppress = suppress

    def __enter__(self):
        self.events.append("open")
        return self

    def __exit__(self, kind, value, tb):
        self.events.append("close")
        return self.suppress and kind is ValueError


if __name__ == "__main__":
    events = []
    with Managed(events):
        events.append("work")
    print(events)

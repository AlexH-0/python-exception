def convert(text):
    return int(text)


def parse_record(text):
    return convert(text)


def run_task(text):
    return parse_record(text)


if __name__ == "__main__":
    try:
        run_task("bad")
    except ValueError:
        import traceback
        traceback.print_exc()

class InputError(Exception):
    pass


def convert(text):
    try:
        return int(text)
    except ValueError as exc:
        exc.add_note("field=count")
        raise InputError("count must be an integer") from exc


if __name__ == "__main__":
    try:
        convert("bad")
    except InputError as exc:
        print(type(exc).__name__, type(exc.__cause__).__name__)
        print(exc.__cause__.__notes__)

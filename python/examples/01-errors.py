"""Inspect an exception object and the traceback that records its call path."""
import traceback


def parse_count(text):
    return int(text)


if __name__ == "__main__":
    try:
        parse_count("pear")
    except ValueError as err:
        print("type:", type(err).__name__)
        print("message:", str(err))
        print("args:", err.args)
        print("traceback frames:")
        for frame in traceback.extract_tb(err.__traceback__):
            print(f"{frame.name}: {frame.line}")

    try:
        compile("if True print('broken')", "<lesson>", "exec")
    except SyntaxError as err:
        print("compile error:", type(err).__name__)

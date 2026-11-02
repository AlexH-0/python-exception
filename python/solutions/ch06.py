class InputError(Exception):
    pass


def convert(text):
    try:
        return int(text)
    except ValueError as error:
        raise InputError("invalid integer") from error

def classify(error):
    if not isinstance(error, BaseException):
        raise TypeError("expected an exception object")
    return "ordinary" if isinstance(error, Exception) else "control"

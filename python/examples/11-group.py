def split_values(group):
    return group.split(ValueError)


if __name__ == "__main__":
    group = ExceptionGroup("batch", [ValueError("bad value"), TypeError("wrong type")])
    matched, remaining = split_values(group)
    print([type(item).__name__ for item in matched.exceptions])
    print([type(item).__name__ for item in remaining.exceptions])

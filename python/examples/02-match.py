def read_key(mapping, key, default=None):
    try:
        return mapping[key]
    except KeyError:
        return default


if __name__ == "__main__":
    print(read_key({"limit": 4}, "limit"))
    print(read_key({}, "limit", 10))

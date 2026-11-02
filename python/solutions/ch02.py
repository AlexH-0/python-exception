def read_key(mapping, key, default=None):
    try:
        return mapping[key]
    except KeyError:
        return default

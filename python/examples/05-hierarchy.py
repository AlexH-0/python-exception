def classify(error):
    return "ordinary" if isinstance(error, Exception) else "control"


if __name__ == "__main__":
    print(classify(ValueError("input")))
    print(classify(KeyboardInterrupt()))

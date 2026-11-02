class TransientError(Exception):
    pass


def retry(operation, attempts=3, sleep=lambda seconds: None):
    for index in range(attempts):
        try:
            return operation()
        except TransientError:
            if index + 1 == attempts:
                raise
            sleep(0.01 * 2 ** index)


if __name__ == "__main__":
    tries = 0

    def sometimes_fails():
        global tries
        tries += 1
        if tries < 3:
            raise TransientError("try again")
        return "ok"

    print(retry(sometimes_fails), tries)

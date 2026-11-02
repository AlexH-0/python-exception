import logging


logger = logging.getLogger(__name__)


def diagnose(operation):
    try:
        operation()
    except Exception as exc:
        logger.exception("operation failed")
        return type(exc).__name__, str(exc)
    return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR)
    print(diagnose(lambda: int("bad")))

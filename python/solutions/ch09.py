import logging
logger = logging.getLogger(__name__)


def diagnose(operation):
    try:
        operation()
    except Exception as error:
        logger.exception("operation failed")
        return type(error).__name__, str(error)
    return None

"""A deliberately small offline task processor with explicit error contracts."""
from .processor import (Task, TaskError, InputError, TransientError, PermanentError,
                        Processor, Result, load_tasks, parse_tasks)

__all__ = ["Task", "TaskError", "InputError", "TransientError", "PermanentError",
           "Processor", "Result", "load_tasks", "parse_tasks"]

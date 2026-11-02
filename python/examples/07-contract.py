class TaskError(Exception):
    pass


class TaskInputError(TaskError):
    def __init__(self, task_id, field, message):
        self.task_id = task_id
        self.field = field
        super().__init__(message)


if __name__ == "__main__":
    error = TaskInputError("t-7", "count", "count must be an integer")
    print(error.task_id, error.field, str(error))

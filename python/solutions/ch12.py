from python.task_processor import Processor


def run_batch(tasks, worker=None):
    return Processor(worker, sleep=lambda _: None).process_batch(tasks)

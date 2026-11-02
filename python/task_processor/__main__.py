import argparse
from dataclasses import asdict
import json
import logging
from pathlib import Path
from .processor import InputError, Processor, load_tasks


def main():
    parser = argparse.ArgumentParser(description="Offline task processor; JSON input, deterministic results")
    parser.add_argument("path", nargs="?", type=Path, default=Path(__file__).with_name("sample_tasks.json"))
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")
    try:
        tasks = load_tasks(args.path)
    except InputError as error:
        logging.exception("input rejected")
        return 2
    results = Processor().process_batch(tasks)
    print(json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2))
    return int(any(result.status == "failed" for result in results))


if __name__ == "__main__":
    raise SystemExit(main())

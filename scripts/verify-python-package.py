"""Verify the downloadable archive independently of the source checkout."""
from pathlib import Path
import os
import subprocess
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
base = (root / ".test-temp").resolve()
base.mkdir(exist_ok=True)
environment = os.environ.copy()
environment.pop("PYTHONPATH", None)
environment.pop("COURSE_IMPL", None)
with TemporaryDirectory(prefix="package-", dir=base) as temporary:
    target = Path(temporary).resolve()
    assert target.parent == base  # Cleanup is limited to this new test directory.
    with ZipFile(root / "public/python-course.zip") as archive:
        for name in archive.namelist():
            assert (target / name).resolve().is_relative_to(target)
        archive.extractall(target)
    for args in [
        ["-m", "pytest", "-q", "-p", "no:cacheprovider"],
        ["-m", "python.semantics.generate", "--check"],
        ["-m", "python.task_processor"],
    ]:
        subprocess.run([sys.executable, *args], cwd=target, env=environment, check=True, timeout=90)
print("Download archive verified independently; temporary extraction cleaned.")

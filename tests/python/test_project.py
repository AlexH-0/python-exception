import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chapter12_project", ROOT / "python/semantics/project.py")
PROJECT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROJECT)
DATA = json.loads((ROOT / "src/data/project.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def generated():
    return PROJECT.generate()


def test_entry_validates_entire_input_before_any_worker_runs():
    rows = {row["id"]: row for row in DATA["entry"]}
    assert rows["valid"]["accepted"] is True
    assert rows["valid"]["tasks"] == [{"id": "a", "value": 2}, {"id": "b", "value": 3}]
    assert rows["valid"]["calls"] == ["a", "b"]
    assert rows["valid"]["error"] is rows["valid"]["cause"] is None
    assert rows["bad-json"]["accepted"] is False
    assert rows["bad-json"]["calls"] == []
    assert rows["bad-json"]["error"] == "InputError"
    assert rows["bad-json"]["cause"] == "JSONDecodeError"
    assert rows["invalid-row"]["accepted"] is False
    assert rows["invalid-row"]["calls"] == []
    assert rows["invalid-row"]["error"] == "InputError"
    assert rows["invalid-row"]["cause"] is None
    assert rows["invalid-row"]["notes"] == ["task index: 1"]


def test_batch_isolates_task_errors_but_unknown_bug_interrupts_without_rollback():
    rows = {row["id"]: row for row in DATA["batches"]}
    expected = rows["expected"]
    assert [r["status"] for r in expected["results"]] == ["done", "failed", "done"]
    assert [r["attempts"] for r in expected["results"]] == [1, 0, 1]
    assert expected["calls"] == ["a", "b", "c"]
    assert expected["committed"] == {"a": 4, "c": 6}
    exhausted = rows["exhausted"]
    assert [r["status"] for r in exhausted["results"]] == ["done", "failed", "done"]
    assert exhausted["calls"] == ["a", "b", "b", "c"]
    assert exhausted["delays"] == [0.01]
    assert exhausted["results"][1]["error"] == "TransientError: busy"
    assert exhausted["committed"] == {"a": 4, "c": 6}
    bug = rows["bug"]
    assert bug["error"] == "TypeError" and bug["results"] is None
    assert bug["calls"] == ["a", "b"]
    assert bug["committed"] == {"a": 4}


def test_cache_scope_conflicts_and_result_fields():
    rows = {row["id"]: row for row in DATA["cache"]}
    same = rows["same"]
    assert [r["status"] for r in same["results"]] == ["done", "cached"]
    assert same["calls"] == ["a"] and same["committed"] == {"a": 4}
    conflict = rows["conflict"]
    assert [r["status"] for r in conflict["results"]] == ["done", "failed", "done"]
    assert conflict["results"][1]["error"].startswith("InputError: conflicting value")
    assert conflict["calls"] == ["a", "b"]
    assert conflict["committed"] == {"a": 4, "b": 6}
    fresh = rows["fresh"]
    assert [r["status"] for r in fresh["results"]] == ["done", "done"]
    assert [r["attempts"] for r in fresh["results"]] == [1, 1]
    assert fresh["calls"] == ["a", "a"] and fresh["committed"] == {"a": 4}
    assert set(same["results"][0]) == {"id", "status", "value", "error", "attempts"}


def test_cli_evidence_and_all_generated_code_matches_checked_json(generated):
    assert generated == DATA
    cli = {row["id"]: row for row in generated["cli"]}
    assert cli["valid"]["exitCode"] == 0
    assert [r["status"] for r in json.loads(cli["valid"]["stdout"])] == ["done", "done", "cached"]
    assert cli["invalid"]["exitCode"] == 2 and cli["invalid"]["stdout"] == ""
    assert cli["invalid"]["stderrLastLine"] == "python.task_processor.processor.InputError: invalid task JSON"
    snippets = [row["code"] for section in (generated["entry"], generated["batches"], generated["cache"]) for row in section]
    for code in snippets:
        compile(code, "<chapter12-project-test>", "exec")
    result = subprocess.run([sys.executable, "-m", "python.task_processor"], cwd=ROOT,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0
    assert json.loads(result.stdout) == json.loads(cli["valid"]["stdout"])

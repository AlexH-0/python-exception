import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chapter10_reliability", ROOT / "python/semantics/reliability.py")
RELIABILITY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RELIABILITY)
DATA = json.loads((ROOT / "src/data/reliability.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def generated():
    return RELIABILITY.generate()


def test_retry_matrix_has_real_attempts_delays_and_last_exception_identity(generated):
    retries = {row["id"]: row["plans"] for row in generated["retries"]}
    assert set(retries) == {"third-success", "always-transient", "permanent", "bug"}
    for plans in retries.values():
        assert [plan["limit"] for plan in plans] == [2, 3]

    expected = {
        "third-success": [
            (2, ["TransientError"] * 2,
             [0.01], "raised", None, "TransientError", True),
            (3, ["TransientError"] * 2 + ["returned"],
             [0.01, 0.02], "returned", 42, None, False),
        ],
        "always-transient": [
            (2, ["TransientError"] * 2,
             [0.01], "raised", None, "TransientError", True),
            (3, ["TransientError"] * 3,
             [0.01, 0.02], "raised", None, "TransientError", True),
        ],
        "permanent": [
            (2, ["PermanentError"], [], "raised", None,
             "PermanentError", True),
            (3, ["PermanentError"], [], "raised", None,
             "PermanentError", True),
        ],
        "bug": [
            (2, ["TypeError"], [], "raised", None,
             "TypeError", True),
            (3, ["TypeError"], [], "raised", None,
             "TypeError", True),
        ],
    }
    for ident, plans in retries.items():
        for plan, (limit, outcomes, delays, kind, value, error, same) in zip(
                plans, expected[ident]):
            assert plan["limit"] == limit
            assert [step["outcome"] for step in plan["attempts"]] == outcomes
            assert plan["delays"] == delays
            assert [step["delayAfter"] for step in plan["attempts"]] == (
                delays + [None] * (len(outcomes) - len(delays)))
            assert plan["kind"] == kind
            assert plan["value"] == value
            assert plan["error"] == error
            assert plan["sameLastException"] is same
            assert len(plan["attempts"]) <= limit


def test_confirmation_loss_stable_key_and_conflict_rejection(generated):
    rows = {row["id"]: row for row in generated["delivery"]}
    assert {ident: row["calls"] for ident, row in rows.items()} == {
        "append": 2, "stable-key": 2, "new-key": 2}
    assert {ident: row["effects"] for ident, row in rows.items()} == {
        "append": [{"key": "append-1", "value": 1},
                   {"key": "append-2", "value": 1}],
        "stable-key": [{"key": "job-10", "value": 1}],
        "new-key": [{"key": "job-10-1", "value": 1},
                    {"key": "job-10-2", "value": 1}],
    }
    for row in rows.values():
        assert row["kind"] == "returned" and row["error"] is None
        assert row["events"].count("effect recorded; confirmation lost") == 1
        expected_last = ("same key with different payload rejected"
                         if row["id"] != "append" else "confirmation received")
        assert row["events"][-1] == expected_last


def test_partial_completion_snapshots_are_taken_at_real_boundaries(generated):
    rows = {row["id"]: row for row in generated["partial"]}
    assert {ident: row["snapshots"] for ident, row in rows.items()} == {
        "restart": [
            {"id": "failure", "writes": 1, "notifyAttempts": 1, "notified": False},
            {"id": "final", "writes": 2, "notifyAttempts": 2, "notified": True}],
        "resume": [
            {"id": "failure", "writes": 1, "notifyAttempts": 1, "notified": False},
            {"id": "final", "writes": 1, "notifyAttempts": 2, "notified": True}],
        "still-fails": [
            {"id": "failure", "writes": 1, "notifyAttempts": 1, "notified": False},
            {"id": "final", "writes": 1, "notifyAttempts": 2, "notified": False}],
    }
    assert rows["restart"]["kind"] == rows["resume"]["kind"] == "returned"
    assert rows["restart"]["error"] is rows["resume"]["error"] is None
    assert rows["still-fails"]["kind"] == "raised"
    assert rows["still-fails"]["error"] == "TransientError"
    for row in rows.values():
        assert row["events"].count("notification failed") == (2 if row["id"] == "still-fails" else 1)
        assert row["events"][-1] in {"notification sent", "notification failed"}


def test_generated_evidence_matches_checked_in_json_including_python_version(generated):
    assert generated == DATA
    assert generated["pythonVersion"] == DATA["pythonVersion"]
    assert generated["retryCode"] == RELIABILITY.RETRY_SOURCE
    snippets = [plan["code"] for row in generated["retries"] for plan in row["plans"]]
    snippets += [row["code"] for row in generated["delivery"]]
    snippets += [row["code"] for row in generated["partial"]]
    for code in snippets:
        compile(code, "<chapter10-snippet>", "exec")
    result = subprocess.run([sys.executable, "-c", snippets[0]], cwd=ROOT,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["value"] is None

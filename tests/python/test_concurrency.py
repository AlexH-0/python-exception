import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chapter11_concurrency", ROOT / "python/semantics/concurrency.py")
CONCURRENCY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONCURRENCY)
DATA = json.loads((ROOT / "src/data/concurrency.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def generated():
    return CONCURRENCY.generate()


def leaf_types(node):
    if not node.get("children"):
        return [node["type"]]
    return [name for child in node["children"] for name in leaf_types(child)]


def test_split_preserves_nested_paths_and_empty_remainder(generated):
    cases = {case["id"]: case for case in generated["split"]["cases"]}
    assert set(cases) == {"ValueError", "TypeError", "Exception"}
    assert cases["ValueError"]["matched"] == {
        "type": "ExceptionGroup", "message": "outer (1 sub-exception)",
        "children": [{"type": "ExceptionGroup", "message": "inner (1 sub-exception)",
                      "children": [{"type": "ValueError", "message": "v"}]}]}
    assert leaf_types(cases["ValueError"]["remainder"]) == ["TypeError", "KeyError"]
    assert cases["TypeError"]["matched"]["children"][0]["children"][0]["type"] == "TypeError"
    assert cases["Exception"]["remainder"] is None
    assert leaf_types(cases["Exception"]["matched"]) == ["ValueError", "TypeError", "KeyError"]


def test_routes_compare_ordinary_star_residual_and_nested(generated):
    rows = {row["id"]: row for row in generated["routes"]}
    assert set(rows) == {"ordinary", "all", "residual", "nested"}
    assert rows["ordinary"]["handled"] == []
    assert leaf_types(rows["ordinary"]["remainder"]) == ["ValueError", "TypeError"]
    assert [row["type"] for row in rows["all"]["handled"]] == ["ValueError", "TypeError"]
    assert rows["all"]["remainder"] is None
    assert rows["all"]["events"] == ["handled ValueError", "handled TypeError"]
    assert leaf_types(rows["residual"]["handled"][0]["tree"]) == ["ValueError"]
    assert leaf_types(rows["residual"]["remainder"]) == ["KeyError"]
    nested = rows["nested"]
    assert nested["handled"][0]["tree"]["children"][0]["message"] == "inner (1 sub-exception)"
    assert nested["handled"][1]["tree"]["children"][0]["message"] == "inner (1 sub-exception)"
    assert leaf_types(nested["remainder"]) == ["KeyError"]


def test_cancel_requests_record_actual_task_state_and_order(generated):
    rows = {row["id"]: row for row in generated["cancel"]}
    assert set(rows) == {"normal", "counter"}
    assert rows["normal"]["events"] == ["worker started", "cancel requested", "cleanup", "caller received cancellation"]
    assert rows["normal"]["cancelled"] is True
    assert rows["normal"]["returned"] is None and rows["normal"]["cleaned"] is True
    assert rows["counter"]["events"] == ["worker started", "cancel requested", "cancellation swallowed", "cleanup", "caller received value"]
    assert rows["counter"]["cancelled"] is False
    assert rows["counter"]["returned"] == "pretend success" and rows["counter"]["cleaned"] is True


def test_taskgroup_cleanup_precedes_group_and_leaf_types_are_real(generated):
    rows = {row["id"]: row for row in generated["taskgroups"]}
    assert set(rows) == {"clean", "cleanup-error"}
    clean = rows["clean"]
    assert clean["leaves"] == ["ValueError"]
    assert clean["peerCancelled"] is True and clean["peerDone"] is True
    assert clean["events"] == ["peer ready", "worker failed", "peer cleanup", "group received"]
    broken = rows["cleanup-error"]
    assert set(broken["leaves"]) == {"ValueError", "RuntimeError"}
    assert broken["peerCancelled"] is False and broken["peerDone"] is True
    assert broken["events"] == ["peer ready", "worker failed", "peer cleanup", "group received"]


def test_generators_and_checked_in_json_match(generated):
    rows = {row["id"]: row for row in generated["generators"]}
    assert set(rows) == {"return", "stop", "close"}
    assert rows["return"]["error"] == "StopIteration"
    assert rows["return"]["cause"] is None and rows["return"]["value"] == 9
    assert rows["stop"]["error"] == "RuntimeError"
    assert rows["stop"]["cause"] == "StopIteration" and rows["stop"]["value"] is None
    assert rows["close"]["error"] is None and rows["close"]["cause"] is None
    assert rows["close"]["value"] is None
    assert rows["close"]["events"] == ["yield open", "caller received open", "GeneratorExit received", "cleanup"]
    assert all(row["cleaned"] for row in rows.values())
    assert generated == DATA
    snippets = [generated["split"]["code"]]
    snippets += [row["code"] for row in generated["routes"]]
    snippets += [row["code"] for row in generated["cancel"]]
    snippets += [row["code"] for row in generated["taskgroups"]]
    snippets += [row["code"] for row in generated["generators"]]
    assert len(generated["split"]["cases"]) + len(generated["routes"]) + len(generated["cancel"]) + len(generated["taskgroups"]) + len(generated["generators"]) == 14
    assert len(snippets) == 12
    for code in snippets:
        compile(code, "<chapter11-snippet>", "exec")
    result = subprocess.run([sys.executable, "-c", snippets[0]], cwd=ROOT,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert len(json.loads(result.stdout)["cases"]) == 3

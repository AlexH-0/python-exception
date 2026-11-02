import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "chapter09_diagnostics", ROOT / "python/semantics/diagnostics.py")
DIAGNOSTICS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DIAGNOSTICS)
DATA = json.loads((ROOT / "src/data/diagnostics.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def generated():
    return DIAGNOSTICS.generate()


def test_trace_matches_real_generated_trace_and_sources(generated):
    trace = generated["trace"]
    assert trace == DATA["trace"]
    assert trace["type"] == "ValueError" and trace["message"] == "invalid literal for int() with base 10: 'bad'"
    assert len(trace["frames"]) == 4
    assert all(frame["source"] == trace["code"].splitlines()[frame["line"] - 1].strip()
               for frame in trace["frames"])


def test_logs_match_real_records_and_source_lines(generated):
    logs = generated["logs"]
    assert logs == DATA["logs"]
    assert [row["afterHandler"] for row in logs] == [True, True, False]
    assert [row["propagated"] for row in logs] == [False, False, True]
    assert [row["hasExcInfo"] for row in logs] == [False, True, True]
    for row in logs:
        assert all(frame["source"] == row["code"].splitlines()[frame["line"] - 1].strip()
                   for frame in row["frames"])


def test_results_match_real_pytest_matrix_and_expected_scores(generated):
    assert generated == DATA
    expected = {
        ("correct", "success"): (1, 0, 0),
        ("correct", "type"): (1, 0, 0),
        ("correct", "contract"): (3, 0, 0),
        ("bool-bug", "success"): (1, 0, 0),
        ("bool-bug", "type"): (1, 0, 0),
        ("bool-bug", "contract"): (2, 1, 1),
        ("cause-bug", "success"): (1, 0, 0),
        ("cause-bug", "type"): (1, 0, 0),
        ("cause-bug", "contract"): (2, 1, 1),
    }
    actual = {(row["implementation"], row["suite"]):
              (row["passed"], row["failed"], row["exitCode"])
              for row in generated["testing"]["results"]}
    assert actual == expected


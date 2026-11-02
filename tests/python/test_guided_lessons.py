"""Truth checks for the concise scripts shown in the guided finally lesson."""
import pytest
from python.semantics.generate import run_scenario
from python.semantics.scenarios import SCENARIOS

@pytest.mark.parametrize("scenario_id,output,error", [
    ("03-result-keep", ["cleanup", "4"], None),
    ("03-result-replace", ["cleanup", "9"], None),
    ("03-result-fail", ["cleanup"], "OSError: cleanup failed"),
    ("03-error-replace", ["cleanup"], "RuntimeError: cleanup failed"),
])
def test_guided_finally_scripts(scenario_id, output, error):
    result = run_scenario(next(s for s in SCENARIOS if s["id"] == scenario_id))
    assert result["output"] == output
    assert result["exception"] == error
    assert any(step["event"] == "output" and step["output"] == ["cleanup"] for step in result["steps"])

"""The API contract is frozen in openapi.json. A change to a route or a request model must be deliberate: regenerate the file
with `python scripts/export_openapi.py` and say so in the pull request."""
import json
import os
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from app.main import app  # noqa: E402

FILE = os.path.join(os.path.dirname(__file__), "..", "openapi.json")

# Endpoints the web app depends on: removing or renaming any of them breaks the frontend.
FROZEN = {
    ("get", "/api/state"), ("post", "/api/tasks/{task_id}/status"), ("post", "/api/observations"), ("post", "/api/soil-tests"),
    ("post", "/api/sensors/{sensor_id}/readings"), ("get", "/api/ndvi-series"), ("get", "/api/forecast"), ("get", "/api/offers"),
    ("post", "/api/listings"), ("post", "/api/offers/{offer_id}/accept"), ("post", "/api/copilot"), ("get", "/api/copilot/status"),
    ("post", "/api/vision"), ("get", "/api/speech/status"), ("post", "/api/stt"), ("post", "/api/tts"), ("post", "/api/sync"),
    ("get", "/api/audit"), ("get", "/api/health"),
}


def test_openapi_file_is_up_to_date():
    committed = json.load(open(FILE, encoding="utf-8"))
    assert committed == json.loads(json.dumps(app.openapi())), "API changed: run  python scripts/export_openapi.py  and commit openapi.json"


def test_frozen_endpoints_still_exist():
    have = {(m, p) for p, ms in app.openapi()["paths"].items() for m in ms}
    assert not (FROZEN - have), f"endpoints removed or renamed: {sorted(FROZEN - have)}"

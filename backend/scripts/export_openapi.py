"""Writes backend/openapi.json from the running app definition. Run it after any API change:  python scripts/export_openapi.py
The file is the API contract between the frontend and the backend; tests/test_contract.py fails if it is out of date."""
import json
import os
import sys
import tempfile

os.environ.setdefault("FA_DB", os.path.join(tempfile.mkdtemp(), "contract.db"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.main import app  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "openapi.json")

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(app.openapi(), f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")
    print("wrote", os.path.abspath(OUT))

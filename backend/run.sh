#!/usr/bin/env bash
# Farm Advisor launcher: creates a venv, installs deps, starts the server.
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
# Local only by default. To let a phone on the same Wi-Fi open it: FA_HOST=0.0.0.0 ./run.sh   (no login: use a trusted network only)
HOST="${FA_HOST:-127.0.0.1}"
echo "Farm Advisor on http://$HOST:8000  (GPS needs https or localhost)"
uvicorn app.main:app --host "$HOST" --port 8000 --reload

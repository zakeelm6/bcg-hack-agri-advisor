# Shortcuts. `make help` lists them.
.PHONY: help api web test check
help:
	@echo "make api     start the API on http://127.0.0.1:8000"
	@echo "make web     start the web app on http://localhost:3000"
	@echo "make test    backend tests"
	@echo "make check   everything the pull request checks run"

api:
	cd backend && ./run.sh

web:
	cd frontend && npm run dev

test:
	cd backend && python -m pytest -q

check: test
	cd backend && python scripts/export_openapi.py && git diff --exit-code openapi.json
	cd frontend && npx tsc --noEmit && node lib/i18n.check.mjs && npm run build

"""Serves the legacy web app (frontend/) until the React app replaces it."""
import os

from fastapi import APIRouter
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from ...core.config import settings

router = APIRouter()
VERSIONED = ("app.js", "i18n.js", "style.css", "index.html")


@router.get("/", include_in_schema=False)
def home():
    """The page carries a version in its script and style URLs, so a changed file is never served from an old copy."""
    d = settings.static_dir
    if not os.path.isfile(os.path.join(d, "index.html")):   # API only: the React app is served by its own server
        return JSONResponse({"service": "Farm Advisor API", "docs": "/docs", "openapi": "/openapi.json"})
    v = str(int(max(os.path.getmtime(os.path.join(d, f)) for f in VERSIONED)))
    return HTMLResponse(open(os.path.join(d, "index.html"), encoding="utf-8").read().replace("__V__", v))


@router.get("/sw.js", include_in_schema=False)
def sw():
    if not os.path.isfile(os.path.join(settings.static_dir, "sw.js")):
        return JSONResponse({"detail": "no service worker served by the API"}, status_code=404)
    return FileResponse(os.path.join(settings.static_dir, "sw.js"), media_type="application/javascript")

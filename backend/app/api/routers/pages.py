"""Serves the legacy web app (frontend/) until the React app replaces it."""
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from ...core.config import settings

router = APIRouter()
VERSIONED = ("app.js", "i18n.js", "style.css", "index.html")


@router.get("/", include_in_schema=False)
def home():
    """The page carries a version in its script and style URLs, so a changed file is never served from an old copy."""
    d = settings.static_dir
    if not os.path.isdir(d):   # the API image does not carry the legacy app
        return JSONResponse({"name": "Sanabils API", "docs": "/docs", "health": "/api/health"})
    v = str(int(max(os.path.getmtime(os.path.join(d, f)) for f in VERSIONED)))
    return HTMLResponse(open(os.path.join(d, "index.html"), encoding="utf-8").read().replace("__V__", v))


@router.get("/sw.js", include_in_schema=False)
def sw():
    if not os.path.isfile(os.path.join(settings.static_dir, "sw.js")):
        raise HTTPException(404, "not served by this server")
    return FileResponse(os.path.join(settings.static_dir, "sw.js"), media_type="application/javascript")

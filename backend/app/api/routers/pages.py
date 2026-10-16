"""Serves the legacy web app (frontend/) until the React app replaces it."""
import os

from fastapi import APIRouter
from fastapi.responses import FileResponse, HTMLResponse

from ...core.config import settings

router = APIRouter()
VERSIONED = ("app.js", "i18n.js", "style.css", "index.html")


@router.get("/", include_in_schema=False)
def home():
    """The page carries a version in its script and style URLs, so a changed file is never served from an old copy."""
    d = settings.static_dir
    v = str(int(max(os.path.getmtime(os.path.join(d, f)) for f in VERSIONED)))
    return HTMLResponse(open(os.path.join(d, "index.html"), encoding="utf-8").read().replace("__V__", v))


@router.get("/sw.js", include_in_schema=False)
def sw():
    return FileResponse(os.path.join(settings.static_dir, "sw.js"), media_type="application/javascript")

"""Farm Advisor API. Run (from backend/): uvicorn app.main:app --reload"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.routers import activities, copilot, farmer, health, market, pages, places, state, sync, tasks, voice
from .core.config import settings
from .db import init_db, session_scope
from .services.advice import refresh_advice


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with session_scope() as db:
        refresh_advice(db)
    yield


app = FastAPI(title="Farm Advisor", version="0.2.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def no_stale_pages(request, call_next):
    """The site is updated often: make browsers ask again instead of reusing an old page, script or style."""
    resp = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static") or request.url.path == "/sw.js":
        resp.headers["Cache-Control"] = "no-cache"
    return resp


for r in (health, state, tasks, market, copilot, voice, sync, farmer, places, activities, pages):
    app.include_router(r.router)

if os.path.isdir(settings.static_dir):   # the legacy web app is optional: the React app (frontend/) runs on its own server
    app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

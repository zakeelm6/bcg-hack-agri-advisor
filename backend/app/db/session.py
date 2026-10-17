"""Engine, sessions and database start-up (migrations, then demo data on a new database)."""
import os
from contextlib import contextmanager

from alembic import command
from fastapi import Request
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import BACKEND_DIR, settings

_url = settings.sqlalchemy_url
engine = create_engine(_url, connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {}, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request):
    """FastAPI dependency: one session per request, limited to the field of the phone that sent it (header X-Device)."""
    from .scope import resolve
    db = SessionLocal()
    try:
        db.info["field_id"] = resolve(db, request.headers.get("x-device"))
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    """For code that runs outside a request (start-up, scripts)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _alembic_config(url: str) -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "migrations"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def run_migrations(url: str | None = None):
    """Brings the database to the latest schema. A database created before migrations existed is adopted, not rebuilt."""
    url = url or _url
    eng = engine if url == _url else create_engine(url)
    names = set(inspect(eng).get_table_names())
    cfg = _alembic_config(url)
    if "fields" in names and "alembic_version" not in names:
        # which revision does this unversioned schema already match? (devices arrived with 0007, plot_offsets arrived with 0002, farmers with 0003, activities with 0004, task quantities with 0005, the farmer's own field with 0006)
        task_cols = {c["name"] for c in inspect(eng).get_columns("tasks")} if "tasks" in names else set()
        field_cols = {c["name"] for c in inspect(eng).get_columns("fields")}
        command.stamp(cfg, "0007" if "devices" in names else "0006" if "source" in field_cols else "0005" if "qty" in task_cols else "0004" if "activities" in names else "0003" if "farmers" in names else "0002" if "plot_offsets" in names else "0001")
    command.upgrade(cfg, "head")


def init_db():
    from .seed import seed_demo_data
    run_migrations()
    with session_scope() as db:
        seed_demo_data(db)

import os
import sys

from alembic import context
from sqlalchemy import create_engine, pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings  # noqa: E402
from app.db.models import Base  # noqa: E402

config = context.config
target_metadata = Base.metadata
URL = config.get_main_option("sqlalchemy.url") or settings.sqlalchemy_url


def run_migrations_offline():
    context.configure(url=URL, target_metadata=target_metadata, literal_binds=True, render_as_batch=URL.startswith("sqlite"))
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    engine = create_engine(URL, poolclass=pool.NullPool)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=URL.startswith("sqlite"))
        with context.begin_transaction():
            context.run_migrations()


run_migrations_offline() if context.is_offline_mode() else run_migrations_online()

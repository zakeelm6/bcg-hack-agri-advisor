"""Database tables (SQLAlchemy 2). The schema is changed only through Alembic migrations (backend/migrations)."""
from sqlalchemy import Float, Integer, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Field(Base):
    __tablename__ = "fields"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    crop: Mapped[str] = mapped_column(Text)
    area_ha: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    sowing_date: Mapped[str] = mapped_column(Text)
    cycle_days: Mapped[int] = mapped_column(Integer)


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(Text)
    col: Mapped[int] = mapped_column(Integer)
    row: Mapped[int] = mapped_column(Integer)
    area_ha: Mapped[float] = mapped_column(Float)
    ndvi: Mapped[float] = mapped_column(Float)
    ndvi_hist: Mapped[str] = mapped_column(Text)          # JSON list, oldest first
    ndvi_source: Mapped[str] = mapped_column(Text)


class Sensor(Base):
    __tablename__ = "sensors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    zone_code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    simulated: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class Reading(Base):
    __tablename__ = "readings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(Integer)
    ts: Mapped[str] = mapped_column(Text)
    moisture: Mapped[float] = mapped_column(Float)
    temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    flags: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")   # JSON list of quality flags (ISMN codes); never deleted, only flagged


class PlotOffset(Base):
    """Learned gap between a plot (zone) and the shared sentinel sensor: moisture_zone = moisture_sentinel + delta."""
    __tablename__ = "plot_offsets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    zone_code: Mapped[str] = mapped_column(Text)
    sentinel_zone: Mapped[str] = mapped_column(Text)
    delta: Mapped[float] = mapped_column(Float)
    sdrd: Mapped[float] = mapped_column(Float)              # spread of the difference: low means the offset transfers well
    n_samples: Mapped[int] = mapped_column(Integer)
    learned_at: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("field_id", "zone_code"),)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(Text, unique=True)
    type: Mapped[str] = mapped_column(Text)
    zone_code: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    what: Mapped[str] = mapped_column(Text)
    when_text: Mapped[str] = mapped_column(Text)
    when_date: Mapped[str] = mapped_column(Text)
    why: Mapped[str] = mapped_column(Text)
    cost: Mapped[str] = mapped_column(Text)
    confidence: Mapped[str] = mapped_column(Text)
    conf_reason: Mapped[str] = mapped_column(Text)
    plan_b: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="open", server_default="open")
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[str] = mapped_column(Text)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(Text, unique=True)
    kind: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    unread: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    ts: Mapped[str] = mapped_column(Text)


class Observation(Base):
    __tablename__ = "observations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    yield_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ts: Mapped[str] = mapped_column(Text)


class Listing(Base):
    __tablename__ = "listings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    qty_min_t: Mapped[float] = mapped_column(Float)
    qty_max_t: Mapped[float] = mapped_column(Float)
    created_at: Mapped[str] = mapped_column(Text)


class Offer(Base):
    __tablename__ = "offers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buyer: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
    price_mad_kg: Mapped[float] = mapped_column(Float)
    pickup: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="open", server_default="open")


class NdviObs(Base):
    __tablename__ = "ndvi_obs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    date: Mapped[str] = mapped_column(Text)
    zone_code: Mapped[str] = mapped_column(Text)
    ndvi: Mapped[float] = mapped_column(Float)
    clear_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    __table_args__ = (UniqueConstraint("field_id", "date", "zone_code"),)


class SoilTest(Base):
    __tablename__ = "soil_tests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    zone_code: Mapped[str] = mapped_column(Text)
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    om_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture: Mapped[float | None] = mapped_column(Float, nullable=True)
    ts: Mapped[str] = mapped_column(Text)


class CopilotLog(Base):
    __tablename__ = "copilot_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
    question: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    numbers_ok: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Cache(Base):
    __tablename__ = "cache"
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    ts: Mapped[str] = mapped_column(Text)

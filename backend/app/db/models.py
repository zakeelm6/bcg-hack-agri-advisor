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
    # Whose field this is. 'demo': the parcel the satellite data was downloaded for. 'own': the farmer's field, its zones and its
    # satellite pictures are made on demand. satellite_status: ready, pending (a download is running), failed, or none (not set up on this server).
    source: Mapped[str] = mapped_column(Text, default="demo", server_default="demo")
    satellite_status: Mapped[str] = mapped_column(Text, default="ready", server_default="ready")
    satellite_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    side_m: Mapped[float | None] = mapped_column(Float, nullable=True)           # side of the square the zones cover
    boundary: Mapped[str | None] = mapped_column(Text, nullable=True)            # JSON [[lat, lng], ...] drawn by the farmer


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(Text)
    col: Mapped[int] = mapped_column(Integer)
    row: Mapped[int] = mapped_column(Integer)
    area_ha: Mapped[float] = mapped_column(Float)
    ndvi: Mapped[float | None] = mapped_column(Float, nullable=True)   # null until a satellite picture of this field has been read
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
    key: Mapped[str] = mapped_column(Text)
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
    qty: Mapped[float | None] = mapped_column(Float, nullable=True)       # the amount the engine decided (mm of water, kg of nitrogen per ha)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)         # mm, kg_n_ha
    status: Mapped[str] = mapped_column(Text, default="open", server_default="open")
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[str] = mapped_column(Text)
    verify_status: Mapped[str] = mapped_column(Text, default="verified", server_default="verified")   # verified | fixed | escalated (independent re-check)
    verify_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    __table_args__ = (UniqueConstraint("field_id", "key", name="uq_tasks_field_key"),)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    key: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    unread: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    ts: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("field_id", "key", name="uq_alerts_field_key"),)


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
    field_id: Mapped[int] = mapped_column(Integer, default=1, server_default="1")   # each farmer has their own copy of the (simulated) offers
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
    field_id: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
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


class Farmer(Base):
    """The farmer's own answers (onboarding). One farmer per field, with the same id as the field. What the engine can use is copied to the field."""
    __tablename__ = "farmers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    crop: Mapped[str | None] = mapped_column(Text, nullable=True)            # key from the app (tomatoes, wheat...) or free text
    planted_on: Mapped[str | None] = mapped_column(Text, nullable=True)      # ISO date
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    irrigation: Mapped[str | None] = mapped_column(Text, nullable=True)
    challenge: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    lang: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[str] = mapped_column(Text)
    # setup (Phase 4b): where the moisture comes from and how the phone connects
    has_sensors: Mapped[str | None] = mapped_column(Text, nullable=True)     # none | shared | own  (None = not asked yet: demo sensors)
    connection: Mapped[str | None] = mapped_column(Text, nullable=True)      # always | sometimes
    advisor_phone: Mapped[str | None] = mapped_column(Text, nullable=True)   # the cooperative or advisor to call: the plan B that always works
    mode: Mapped[str | None] = mapped_column(Text, nullable=True)            # simple | full (the app's view)


class Activity(Base):
    """What the farmer did (watered, sprayed, planted, spent money), as recorded in the app.
    `client_id` is the app's own id for the entry: sending the same entry twice (a retry after a network error) is harmless."""
    __tablename__ = "activities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(Text)
    field_id: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    type: Mapped[str] = mapped_column(Text)                      # irrigation, treatment, planting, expense, other
    date: Mapped[str] = mapped_column(Text)                      # ISO date the work was done
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    zone_code: Mapped[str | None] = mapped_column(Text, nullable=True)   # null = the whole field
    amount_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("field_id", "client_id", name="uq_activities_field_client"),)


class Device(Base):
    """A phone. The app makes a random token on first launch and sends it with every request; only its hash is kept here.
    A device owns one field (and the farmer with the same id). Nothing else identifies a farmer: there is no login yet."""
    __tablename__ = "devices"
    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[str] = mapped_column(Text)
    last_seen: Mapped[str] = mapped_column(Text)

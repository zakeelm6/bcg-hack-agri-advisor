"""What the API returns. Models allow extra keys, so adding a field to a route never breaks a client; required keys are the ones clients rely on."""
from pydantic import BaseModel, ConfigDict


class Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Ok(Loose):
    ok: bool


class FieldOut(Loose):
    id: int
    name: str
    crop: str
    area_ha: float
    lat: float
    lon: float
    sowing_date: str
    cycle_days: int


class ZoneOut(Loose):
    id: int
    field_id: int
    code: str
    col: int
    row: int
    area_ha: float
    ndvi: float
    ndvi_hist: list[float]
    ndvi_source: str
    moisture: float | None = None
    moisture_source: str | None = None
    confidence: str
    conf_reason: str
    has_sensor: bool
    sensor_quality: str | None = None       # high / medium / low / insufficient, from the quality checks (Phase 2)
    offset: dict | None = None              # learned gap to the shared sensor: {sentinel, delta, sdrd, n, transferable}
    soil_test: dict | None = None


class SensorOut(Loose):
    id: int
    field_id: int
    zone_code: str
    name: str
    simulated: bool
    moisture: float
    updated_at: str
    quality: str | None = None              # high / medium / low / insufficient
    flags: list[str] = []                   # quality flags on the recent readings (ISMN codes, see docs/SENSORS.md)
    flag_text: list[str] = []
    good_share: float | None = None


class TaskOut(Loose):
    id: int
    key: str
    type: str
    zone_code: str
    title: str
    what: str
    when_text: str
    when_date: str
    why: str
    cost: str
    confidence: str
    conf_reason: str
    plan_b: str
    status: str
    x: float
    y: float


class AlertOut(Loose):
    id: int
    key: str
    kind: str
    title: str
    body: str
    unread: int
    ts: str


class WeatherDay(Loose):
    date: str
    rain: float
    et0: float
    tmax: float | None = None
    tmin: float | None = None


class WeatherOut(Loose):
    days: list[WeatherDay]
    source: str
    age_hours: float | None = None


class SoilTestOut(Loose):
    zone_code: str
    ph: float | None = None
    om_pct: float | None = None
    moisture: float | None = None
    ts: str
    age_days: int


class StateOut(Loose):
    field: FieldOut
    zones: list[ZoneOut]
    sensors: list[SensorOut]
    tasks: list[TaskOut]
    alerts: list[AlertOut]
    weather: WeatherOut
    soil_tests: list[SoilTestOut]
    generated_at: str
    data_notes: dict


class NdviPoint(Loose):
    zone_code: str
    date: str
    ndvi: float
    clear_share: float | None = None


class NdviSeriesOut(Loose):
    real: bool
    source: str
    points: list[NdviPoint]
    note: str


class ForecastOut(Loose):
    crop: str
    qty_min_t: float
    qty_max_t: float
    window_start: str
    window_end: str
    confidence: str
    mean_vigor: float
    note: str
    advice: str
    listing: dict | None = None


class OfferOut(Loose):
    id: int
    buyer: str
    kind: str
    price_mad_kg: float
    pickup: str
    status: str
    est_value_mad: int | None = None      # value of the expected harvest at this price, from the server's forecast


class OffersOut(Loose):
    simulated: bool
    offers: list[OfferOut]
    harvest_mid_t: float | None = None


class CopilotOut(Loose):
    text: str
    source: str            # engine, model or saved
    numbers_ok: bool
    intent: str | None = None
    actions: list[dict] = []
    note: str | None = None


class CopilotStatusOut(Loose):
    mode: str
    provider: str
    vision: bool
    note: str


class VisionOut(Loose):
    available: bool
    reason: str | None = None
    observations: list[str] | None = None
    possible_causes_to_check: list[str] | None = None
    confidence: str | None = None
    diagnosis: None = None
    note: str | None = None


class SpeechStatusOut(Loose):
    available: bool
    provider: str | None = None
    langs: list[str] = []


class SttOut(Loose):
    text: str


class AuditEntry(Loose):
    ts: str
    kind: str
    question: str | None = None
    answer: str
    source: str
    numbers_ok: int
    note: str | None = None


class AuditOut(Loose):
    entries: list[AuditEntry]


class SyncResult(Loose):
    type: str
    ok: bool
    error: str | None = None


class SyncOut(Loose):
    results: list[SyncResult]


class ChatOut(Loose):
    """The shape the React app's Co-Pilot displays."""
    recommendation: str
    why: str
    steps: list[str]
    missing: list[str]


class AnomaliesOut(Loose):
    """GeoJSON FeatureCollection of persistent satellite anomalies, with honest metadata (Phase 2)."""
    type: str
    features: list[dict]
    available: bool
    source: str | None = None
    dates: int = 0
    note: str


class FarmerOut(Loose):
    """The saved profile, what the engine now uses from it, and what it could not use (honest)."""
    saved: bool
    profile: dict | None = None
    applied: dict = {}
    not_applied: list[str] = []


class PlaceOut(Loose):
    """The town name at a position, or null when the name service did not answer."""
    place: str | None = None

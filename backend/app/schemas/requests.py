"""What the API accepts. Class names are part of the public contract (openapi.json)."""
from typing import Literal

from pydantic import BaseModel, Field


class Reading(BaseModel):
    moisture: float
    temp_c: float | None = None


class StatusBody(BaseModel):
    status: str


class Observation(BaseModel):
    task_id: int | None = None
    result: str | None = None
    note: str | None = None
    photo: str | None = None
    yield_kg: float | None = None


class SoilTest(BaseModel):
    zone_code: str
    ph: float | None = None
    om_pct: float | None = None
    moisture: float | None = None   # fraction (0.24 = 24%) measured when the sample was taken


class CopilotBody(BaseModel):
    question: str
    task_id: int | None = None
    lang: str = "en"


class VisionBody(BaseModel):
    photo: str
    zone: str = "A"


class TtsBody(BaseModel):
    text: str
    lang: str = "en"


class Action(BaseModel):
    type: str
    payload: dict = {}


class FarmerBody(BaseModel):
    """The onboarding answers of the React app. Stable English keys for the choices; free text allowed for the crop."""
    location: str | None = Field(None, max_length=120)
    crop: str | None = Field(None, max_length=60)
    planted_on: str | None = None                      # ISO date, or null when unknown
    area_ha: float | None = Field(None, gt=0, le=10000)
    irrigation: str | None = Field(None, max_length=40)
    challenge: str | None = Field(None, max_length=40)
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    boundary: list[list[float]] | None = Field(None, max_length=200)   # corners [lat, lng] the farmer drew; used for the centre of the field
    lang: str | None = None
    # setup (optional, each kept when omitted)
    has_sensors: str | None = Field(None, pattern="^(none|shared|own)$")   # none: satellite + weather only, no sensor data used
    connection: str | None = Field(None, pattern="^(always|sometimes)$")   # sometimes: the phone keeps everything and sends when it has network
    advisor_phone: str | None = Field(None, max_length=30)
    mode: str | None = Field(None, pattern="^(simple|full)$")


class SyncBody(BaseModel):
    actions: list[Action]


class ChatBody(BaseModel):
    """What the React app (frontend/lib/copilot.ts) sends: the question, an optional photo and the app's own context."""
    question: str = Field(max_length=400)
    photo: str | None = None
    context: dict = {}
    lang: str = "en"             # en, fr or ar


class ActivityBody(BaseModel):
    """One entry of the farmer's Activities list (watered, sprayed, planted, spent money, other work)."""
    client_id: str = Field(min_length=8, max_length=64)           # the app's own id: sending the same entry twice is harmless
    type: Literal["irrigation", "treatment", "planting", "expense", "other"]
    date: str                                                      # ISO date the work was done
    note: str = Field("", max_length=200)
    cost: float | None = Field(None, ge=0, le=10_000_000)
    zone: str | None = Field(None, max_length=4)                   # null = the whole field
    amount_mm: float | None = Field(None, gt=0, le=300)            # water applied, when known

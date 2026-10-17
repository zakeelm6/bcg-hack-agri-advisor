"""What the API accepts. Class names are part of the public contract (openapi.json)."""
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
    lang: str | None = None


class SyncBody(BaseModel):
    actions: list[Action]


class ChatBody(BaseModel):
    """What the React app (frontend/lib/copilot.ts) sends: the question, an optional photo and the app's own context."""
    question: str = Field(max_length=400)
    photo: str | None = None
    context: dict = {}
    lang: str = "en"             # en, fr or ar

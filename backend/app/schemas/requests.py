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


class SyncBody(BaseModel):
    actions: list[Action]


class ChatBody(BaseModel):
    """What the React app (frontend/lib/copilot.ts) sends: the question, an optional photo and the app's own context."""
    question: str = Field(max_length=400)
    photo: str | None = None
    context: dict = {}
    lang: str = "en"             # en, fr or ar

"""Season plan, daily briefing and missing questions, built from the farmer profile and the field (Phase 4)."""
from sqlalchemy.orm import Session

from ..processing import geo, season
from . import farmer, field as fld
from .common import clean_lang


def plan(db: Session, lang: str = "en") -> dict:
    lang = clean_lang(lang)
    field = fld.get_field(db)
    soil = fld.latest_soil(db)
    om = next((t["om_pct"] for t in soil.values() if t.get("om_pct") is not None), None)
    return season.build_season_plan(field, farmer.get(db), lang=lang, soil={"om_pct": om})


def briefing(db: Session, lang: str = "en") -> dict:
    from .advice import build_state
    lang = clean_lang(lang)
    state = build_state(db, lang)
    p = season.build_season_plan(state["field"], farmer.get(db), lang=lang)
    text = season.briefing(p, state["tasks"], state["weather"], lang=lang)
    return {"text": text, "lang": lang, "stage": p["stage"], "week": p["week"], "open_tasks": sum(1 for t in state["tasks"] if t["status"] == "open"),
            "escalated": sum(1 for t in state["tasks"] if t["status"] == "open" and t.get("verify_status") == "escalated"), "source": "engine"}

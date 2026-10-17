"""Copilot, vision and audit log. The engine decides, the model (optional) only words the answer, and every exchange is logged."""
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import models as m
from ..processing import copilot, engine, llm
from ..schemas import requests as rq
from . import activities, field as fld
from .advice import build_state
from .common import as_dict, clean_lang, now_iso


def log(db: Session, kind, question, answer, source, ok, note=None):
    db.add(m.CopilotLog(ts=now_iso(), kind=kind, question=question, answer=answer, source=source, numbers_ok=1 if ok else 0, note=note))
    db.commit()


def status() -> dict:
    info = llm.provider_info()
    return {"mode": info["mode"], "provider": info["provider"], "vision": info["vision"],
            "note": "Answers come from the model, checked against the facts." if info["mode"] == "model"
            else "Answers come from the rule engine. No language model is configured."}


def ask(db: Session, question: str, task_id: int | None, lang: str, log_it: bool = True) -> dict:
    q = question.strip()
    if not q:
        raise HTTPException(422, "type a question")
    if len(q) > copilot.MAX_QUESTION:
        raise HTTPException(422, f"keep the question under {copilot.MAX_QUESTION} characters")
    lang = clean_lang(lang)
    st = build_state(db, lang)
    st["spending"] = activities.spending(db)   # what the farmer recorded spending: the Copilot's only source for cost-of-the-season questions
    field, zones, sensors, weather, soil = fld.engine_inputs(db)
    res = copilot.answer(q, st, task_id, lambda d: engine.what_if_wait(field, zones, sensors, weather, soil, d, lang=lang), lang)
    if log_it:
        log(db, "question", q, res["text"], res["source"], res["numbers_ok"], res["note"])
    return res


def vision(db: Session, b: rq.VisionBody) -> dict:
    res = copilot.vision_notes(b.photo, b.zone)
    log(db, "photo", f"photo zone {b.zone}", json.dumps({k: v for k, v in res.items() if k != "photo"}), "model" if res["available"] else "none", True)
    return res


def audit(db: Session) -> dict:
    rows = db.scalars(select(m.CopilotLog).order_by(m.CopilotLog.id.desc()).limit(30))
    keep = ("ts", "kind", "question", "answer", "source", "numbers_ok", "note")
    return {"entries": [{k: v for k, v in as_dict(r).items() if k in keep} for r in rows]}

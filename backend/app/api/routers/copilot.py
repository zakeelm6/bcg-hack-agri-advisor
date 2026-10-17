from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.ratelimit import copilot_brake
from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import AuditOut, ChatOut, CopilotOut, CopilotStatusOut, VisionOut
from ...services import chat as chat_service, copilot_service as svc

router = APIRouter()


@router.get("/api/copilot/status", response_model=CopilotStatusOut)
def copilot_status():
    return svc.status()


@router.post("/api/copilot", response_model=CopilotOut)
def copilot_ask(b: rq.CopilotBody, db: Session = Depends(get_db)):
    if not b.question.strip():
        raise HTTPException(422, "type a question")
    if not copilot_brake.allow():
        raise HTTPException(429, "too many questions, wait a minute")
    return svc.ask(db, b.question, b.task_id, b.lang)


@router.post("/api/chat", response_model=ChatOut)
def chat(b: rq.ChatBody, db: Session = Depends(get_db)):
    """Adapter for the React app's Co-Pilot: engine advice in the shape its screen displays."""
    if not b.question.strip():
        raise HTTPException(422, "type a question")
    if not copilot_brake.allow():
        raise HTTPException(429, "too many questions, wait a minute")
    return chat_service.chat(db, b)


@router.post("/api/vision", response_model=VisionOut)
def vision(b: rq.VisionBody, db: Session = Depends(get_db)):
    if not copilot_brake.allow():
        raise HTTPException(429, "too many requests, wait a minute")
    return svc.vision(db, b)


@router.get("/api/audit", response_model=AuditOut)
def audit(db: Session = Depends(get_db)):
    return svc.audit(db)

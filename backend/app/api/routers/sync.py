from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import SyncOut
from ...services import sync

router = APIRouter()


@router.post("/api/sync", response_model=SyncOut)
def sync_actions(b: rq.SyncBody, db: Session = Depends(get_db)):
    """Replays actions queued on the phone while it was offline. Each result is reported separately."""
    return {"results": sync.replay(db, b.actions)}

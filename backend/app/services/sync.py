"""Replays the actions a phone queued while it was offline. Each result is reported separately."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..schemas import requests as rq
from . import activities, farmer, market, tasks


def replay(db: Session, actions: list[rq.Action]) -> list[dict]:
    results = []
    for a in actions:
        try:
            if a.type == "task_status":
                tasks.set_status(db, int(a.payload["task_id"]), a.payload["status"])
            elif a.type == "observation":
                tasks.add_observation(db, rq.Observation(**a.payload))
            elif a.type == "soil_test":
                tasks.add_soil_test(db, rq.SoilTest(**a.payload))
            elif a.type == "activity":
                activities.save(db, rq.ActivityBody(**a.payload))
            elif a.type == "activity_remove":
                activities.remove(db, str(a.payload["client_id"]))
            elif a.type == "listing":
                market.create_listing(db)
            elif a.type == "offer_accept":
                market.accept_offer(db, int(a.payload["offer_id"]))
            elif a.type == "farmer":
                farmer.save(db, rq.FarmerBody(**a.payload))
            else:
                raise HTTPException(422, f"unknown action {a.type}")
            results.append({"type": a.type, "ok": True})
        except HTTPException as e:
            results.append({"type": a.type, "ok": False, "error": e.detail})
        except Exception as e:  # keep the batch going; report the failure
            results.append({"type": a.type, "ok": False, "error": str(e)})
    return results

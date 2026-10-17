import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...db import get_db, models as m
from ...db.scope import fid
from ...schemas.responses import FieldInfoOut
from ...services import own_field

router = APIRouter()


@router.get("/api/field", response_model=FieldInfoOut)
def field_info(db: Session = Depends(get_db)):
    """Whose field the engine works on (the demo parcel or the farmer's own), where, and the state of its satellite pictures."""
    return own_field.describe(db)


@router.post("/api/field/satellite", response_model=FieldInfoOut)
def field_satellite_retry(db: Session = Depends(get_db)):
    """Try the satellite download again (after a failure, or when it was interrupted)."""
    return own_field.retry(db)


@router.get("/api/field/picture", include_in_schema=True, responses={200: {"description": "PNG, true-colour Sentinel-2 picture around the field", "content": {"image/png": {"schema": {"type": "string", "format": "binary"}}}}})
def field_picture(db: Session = Depends(get_db)):
    f = db.get(m.Field, fid(db))
    p = own_field.picture_path(f.id, f.source)
    if not p or not os.path.exists(p):
        raise HTTPException(404, "no picture of the field yet")
    return FileResponse(p, media_type="image/png", headers={"Cache-Control": "no-cache"})

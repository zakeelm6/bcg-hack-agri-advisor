from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db, models as m
from ...schemas.responses import AnomaliesOut, ForecastOut, NdviSeriesOut, StateOut
from ...services import advice, field as fld, market, satellite_layer
from ...services.common import as_dict

router = APIRouter()

NDVI_NOTE = {"fr": "Les dates avec nuages, ombres ou trop peu de pixels clairs sont absentes. Pixels de 10 m : environ 55 par zone.",
             "ar": "التواريخ ذات السحب أو الظلال أو البكسلات الصافية القليلة غير موجودة. بكسلات 10 م: حوالي 55 لكل منطقة."}


@router.get("/api/state", response_model=StateOut)
def state(refresh: bool = False, lang: str = "en", db: Session = Depends(get_db)):
    return advice.build_state(db, lang, refresh)


@router.get("/api/ndvi-series", response_model=NdviSeriesOut)
def ndvi_series(lang: str = "en", db: Session = Depends(get_db)):
    """Clear-sky NDVI per zone and date. Empty when the satellite data has not been downloaded (vigor is simulated then)."""
    zones = fld.get_zones(db)
    rows = db.scalars(select(m.NdviObs).where(m.NdviObs.field_id == 1).order_by(m.NdviObs.date, m.NdviObs.zone_code))
    points = [{k: as_dict(r)[k] for k in ("zone_code", "date", "ndvi", "clear_share")} for r in rows]
    source = zones[0]["ndvi_source"] if zones else "none"
    return {"real": source.startswith("sentinel-2"), "source": source, "points": points,
            "note": NDVI_NOTE.get(lang, "Dates with clouds, shadows or too few clear pixels are missing. 10 m pixels: about 55 per zone.")}


@router.get("/api/forecast", response_model=ForecastOut)
def forecast(lang: str = "en", db: Session = Depends(get_db)):
    return market.forecast(db, lang)


@router.get("/api/zones/anomalies", response_model=AnomaliesOut)
def zone_anomalies(lang: str = "en"):
    """Persistent vigor anomalies from the Sentinel-2 pixels (GeoJSON). Empty with available=false until the pixels are downloaded."""
    return satellite_layer.geojson(lang)

"""Demo data for a new database.

Everything seeded here is DEMO DATA: the zone vigor values (NDVI) and the two sensors are simulated, and are labelled as
such in the API and the app.
"""
import json
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m

# Demo field: a 2.4 ha plot in the Berrechid plain, split into 4 zones.
SEED_ZONES = [  # code, col, row, ndvi history (oldest -> latest)
    ("A", 0, 0, [0.71, 0.72, 0.72, 0.72]),
    ("B", 1, 0, [0.60, 0.59, 0.58, 0.58]),
    ("C", 0, 1, [0.56, 0.55, 0.55, 0.55]),
    ("D", 1, 1, [0.50, 0.46, 0.42, 0.38]),
]
SEED_SENSORS = [("A", "Sentinel sensor A"), ("B", "Sentinel sensor B")]
SEED_OFFERS = [
    ("School canteens network", "institution", 3.20, "Pickup at the village collection point"),
    ("Local trader", "trader", 3.00, "Collects from the field"),
    ("Village cooperative", "cooperative", 2.90, "Delivery to the cooperative store"),
]


def seed_demo_data(db: Session):
    if db.scalar(select(func.count()).select_from(m.Field)):
        return
    sowing = (date.today() - timedelta(days=58)).isoformat()
    db.add(m.Field(id=1, name="Field A", crop="Potato", area_ha=2.4, lat=33.27, lon=-7.58, sowing_date=sowing, cycle_days=90))
    for code, col, row, hist in SEED_ZONES:
        db.add(m.Zone(field_id=1, code=code, col=col, row=row, area_ha=0.6, ndvi=hist[-1], ndvi_hist=json.dumps(hist), ndvi_source="simulated"))
    now = datetime.utcnow()
    base = {"A": 0.30, "B": 0.26}
    for code, name in SEED_SENSORS:
        sensor = m.Sensor(field_id=1, zone_code=code, name=name, simulated=1)
        db.add(sensor)
        db.flush()
        for k, d in enumerate([2, 1, 0]):
            db.add(m.Reading(sensor_id=sensor.id, ts=(now - timedelta(days=d)).isoformat(timespec="seconds"),
                             moisture=round(base[code] + 0.01 * (2 - k), 3), temp_c=21.0))
    for buyer, kind, price, pickup in SEED_OFFERS:
        db.add(m.Offer(buyer=buyer, kind=kind, price_mad_kg=price, pickup=pickup))
    db.commit()

import os
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.core.ratelimit import geo_brake  # noqa: E402
from app.main import app  # noqa: E402
from app.services import places  # noqa: E402


class Resp:
    def __init__(self, payload, status=200):
        self.payload, self.status_code = payload, status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("bad", request=None, response=None)

    def json(self):
        return self.payload


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    places._cache.clear()
    geo_brake._calls.clear()


def test_place_name_from_the_service_and_the_language_asked(monkeypatch):
    seen = []
    monkeypatch.setattr(httpx, "get", lambda url, **kw: (seen.append(kw["params"]), Resp({"city": "Berrechid", "locality": "x"}))[1])
    with TestClient(app) as c:
        assert c.get("/api/geo/place?lat=33.2716&lon=-7.5819&lang=ary").json() == {"place": "Berrechid"}
    assert seen[0]["localityLanguage"] == "ar" and seen[0]["latitude"] == 33.2716      # Darija asks for Arabic names


def test_falls_back_to_locality_then_region(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: Resp({"city": "", "locality": "", "principalSubdivision": "Casablanca-Settat"}))
    with TestClient(app) as c:
        assert c.get("/api/geo/place?lat=33&lon=-7").json()["place"] == "Casablanca-Settat"


def test_same_area_is_cached(monkeypatch):
    n = []
    monkeypatch.setattr(httpx, "get", lambda *a, **k: (n.append(1), Resp({"city": "Settat"}))[1])
    with TestClient(app) as c:
        c.get("/api/geo/place?lat=33.001&lon=-7.002")
        c.get("/api/geo/place?lat=33.004&lon=-7.004")      # same square of about one kilometre
    assert len(n) == 1


def test_service_down_gives_null_not_an_error(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("down")))
    with TestClient(app) as c:
        r = c.get("/api/geo/place?lat=33&lon=-7")
        assert r.status_code == 200 and r.json() == {"place": None}


def test_bad_positions_are_refused_and_the_rate_is_limited(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: Resp({"city": "A"}))
    with TestClient(app) as c:
        assert c.get("/api/geo/place?lat=95&lon=0").status_code == 422
        assert c.get("/api/geo/place?lat=0").status_code == 422
        codes = [c.get(f"/api/geo/place?lat={i / 100}&lon=1").status_code for i in range(35)]
    assert codes.count(429) >= 1

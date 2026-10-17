import pytest

from app.core.ratelimit import copilot_brake, geo_brake, voice_brake


@pytest.fixture(autouse=True)
def fresh_brakes():
    """The rate limits are per process: without this the many Copilot calls of a full test run would hit the real limit."""
    for b in (copilot_brake, voice_brake, geo_brake):
        b._calls.clear()
    yield

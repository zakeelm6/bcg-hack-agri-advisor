import os
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.processing import speech  # noqa: E402
from app.main import app  # noqa: E402

WAV = b"RIFF" + b"\0" * 4000


class FakeResp:
    def __init__(self, status=200, json=None, content=b""):
        self.status_code, self._json, self.content = status, json or {}, content

    def json(self):
        return self._json


@pytest.fixture
def azure(monkeypatch):
    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "westeurope")
    speech._cache.clear()
    calls = []
    monkeypatch.setattr(httpx, "post", lambda url, **kw: (calls.append((url, kw)), FakeResp(json={"RecognitionStatus": "Success", "DisplayText": "Why?"}, content=b"MP3"))[1])
    return calls


def test_status_without_key(monkeypatch):
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    with TestClient(app) as c:
        assert c.get("/api/speech/status").json()["available"] is False
        assert c.post("/api/stt?lang=en", content=WAV).status_code == 503
        assert c.post("/api/tts", json={"text": "hello", "lang": "en"}).status_code == 503


def test_status_never_exposes_the_key(azure):
    with TestClient(app) as c:
        j = c.get("/api/speech/status").json()
        assert j["available"] is True and "test-key" not in str(j)


def test_stt_sends_the_right_language_and_key(azure):
    with TestClient(app) as c:
        r = c.post("/api/stt?lang=ar", content=WAV)
        assert r.json() == {"text": "Why?"}
    url, kw = azure[0]
    assert url.startswith("https://westeurope.stt.speech.microsoft.com/") and kw["params"]["language"] == "ar-MA"
    assert kw["headers"]["Ocp-Apim-Subscription-Key"] == "test-key"


def test_stt_rejects_bad_audio_and_language(azure):
    with TestClient(app) as c:
        assert c.post("/api/stt?lang=en", content=b"not audio").status_code == 422
        assert c.post("/api/stt?lang=xx", content=WAV).status_code == 422
        assert c.post("/api/stt?lang=en", content=b"RIFF" + b"\0" * 2_100_000).status_code == 422


def test_tts_returns_audio_and_caches(azure):
    with TestClient(app) as c:
        r1 = c.post("/api/tts", json={"text": "Irrigate zone D", "lang": "fr"})
        r2 = c.post("/api/tts", json={"text": "Irrigate zone D", "lang": "fr"})
        assert r1.content == r2.content == b"MP3" and r1.headers["content-type"] == "audio/mpeg"
    assert len(azure) == 1
    assert "fr-FR-DeniseNeural" in azure[0][1]["content"].decode()


def test_tts_escapes_text_and_limits_length(azure):
    with TestClient(app) as c:
        c.post("/api/tts", json={"text": "a <b> & c", "lang": "en"})
        assert "&lt;b&gt; &amp; c" in azure[-1][1]["content"].decode()
        assert c.post("/api/tts", json={"text": "x" * 1300, "lang": "en"}).status_code == 422
        assert c.post("/api/tts", json={"text": "  ", "lang": "en"}).status_code == 422


def test_azure_failure_becomes_a_clean_error(monkeypatch, azure):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResp(status=401))
    with TestClient(app) as c:
        r = c.post("/api/tts", json={"text": "hello", "lang": "en"})
        assert r.status_code == 502 and "key" in r.json()["detail"] and "test-key" not in r.text
    monkeypatch.setattr(httpx, "post", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("down")))
    with TestClient(app) as c:
        assert c.post("/api/stt?lang=en", content=WAV).status_code == 502


def test_no_match_gives_empty_text(monkeypatch, azure):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResp(json={"RecognitionStatus": "NoMatch"}))
    with TestClient(app) as c:
        assert c.post("/api/stt?lang=en", content=WAV).json() == {"text": ""}


def test_dotenv_file_is_found_in_the_backend_folder():
    """llm.py loads backend/.env for every key (Azure, model). It broke once when the module moved into app/processing/."""
    import os
    from app.processing import llm
    assert os.path.normpath(llm.ENV_FILE) == os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".env"))

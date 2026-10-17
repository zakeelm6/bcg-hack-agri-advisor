"""Darija (Moroccan Arabic, code "ary"): same decisions and numbers as the other languages, wording in Darija, Arabic script,
and a fallback to standard Arabic for any text that has no Darija version."""
import os
import re
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.processing import copilot, engine, speech  # noqa: E402
from app.main import app  # noqa: E402
from app.services.common import clean_lang, pick  # noqa: E402

ARABIC = re.compile(r"[؀-ۿ]")
NUM = re.compile(r"\d+(?:[.,]\d+)?")


def numbers(text):
    return sorted(NUM.findall(text))


def test_darija_is_an_accepted_language():
    assert clean_lang("ary") == "ary" and clean_lang("xx") == "en"


def test_darija_has_every_text_that_standard_arabic_has():
    assert set(engine.TEXTS["ary"]) == set(engine.TEXTS["ar"])
    assert set(copilot.CT["ary"]) == set(copilot.CT["ar"])
    assert set(copilot.CT["ary"]["conf_name"]) == {"High", "Medium", "Low"}


def test_darija_texts_format_with_the_same_placeholders_as_english():
    """A wrong placeholder would crash at runtime, so check every text against the English one."""
    fields = lambda s: sorted(re.findall(r"{(\w+)}", s))
    for key, text in engine.TEXTS["ary"].items():       # Arabic may leave out a number (for example the days of a wait), so compare with Arabic
        assert fields(text) == fields(engine.TEXTS["ar"][key]), key
    for key, text in copilot.CT["ary"].items():       # Arabic uses {unit} and {tasks_word} where English uses {s}, so compare with Arabic
        if isinstance(text, str):
            assert fields(text) == fields(copilot.CT["ar"][key]), key


def test_missing_darija_text_falls_back_to_standard_arabic_then_english(monkeypatch):
    monkeypatch.delitem(engine.TEXTS["ary"], "rain_none")
    assert engine.tr("ary", "rain_none") == engine.TEXTS["ar"]["rain_none"]
    monkeypatch.delitem(engine.TEXTS["ar"], "rain_none")
    assert engine.tr("ary", "rain_none") == engine.TEXTS["en"]["rain_none"]
    assert pick({"ar": "A", "en": "E"}, "ary", "D") == "A" and pick({"fr": "F"}, "ary", "D") == "D"


def test_darija_weekdays():
    assert engine._wd("2026-10-19", "ary") == "التنين" and engine._wd("2026-10-18", "ary") == "الحد"


def test_state_in_darija_keeps_the_same_numbers_and_decisions():
    with TestClient(app) as c:
        en = c.get("/api/state?lang=en").json()
        ary = c.get("/api/state?lang=ary").json()
        assert [t["key"] for t in en["tasks"]] == [t["key"] for t in ary["tasks"]]
        for a, b in zip(en["tasks"], ary["tasks"]):
            assert numbers(a["title"]) == numbers(b["title"]), (a["title"], b["title"])
            assert ARABIC.search(b["title"]) and ARABIC.search(b["why"])
        assert any(ARABIC.search(x["title"]) for x in ary["alerts"])


def test_copilot_understands_darija_questions():
    cases = {"شحال غادي يكلف السقي": "cost", "فوقاش نسقي": "when", "علاش خصني نسقي": "why",
             "واش نتسنى نهارين": "whatif", "شنو ندير اليوم": "plan", "ما قدرتش نسقي كلشي": "planb", "هاد النبتة مريضة": "diagnose"}
    for q, intent in cases.items():
        assert copilot.detect(q)[0] == intent, q


def test_copilot_answers_in_darija_and_never_invents_a_number():
    with TestClient(app) as c:
        r = c.post("/api/copilot", json={"question": "علاش خصني نسقي؟", "lang": "ary"}).json()
        assert ARABIC.search(r["text"]) and r["numbers_ok"] is True
        w = c.post("/api/copilot", json={"question": "واش نتسنى نهارين", "lang": "ary"}).json()
        assert "نهارين" in w["text"] or "نهار" in w["text"] or ARABIC.search(w["text"])
        chat = c.post("/api/chat", json={"question": "شنو ندير اليوم", "lang": "ary"}).json()
        assert ARABIC.search(chat["recommendation"] + chat["why"])


def test_darija_voice_uses_the_moroccan_arabic_locale_and_voice(monkeypatch):
    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "francecentral")
    speech._cache.clear()
    sent = []

    class Resp:
        status_code, content = 200, b"MP3"

        def json(self):
            return {"RecognitionStatus": "Success", "DisplayText": "بغيت نسقي"}

    monkeypatch.setattr(httpx, "post", lambda url, **kw: (sent.append(kw), Resp())[1])
    assert speech.synthesize("بغيت نسقي الأرض", "ary") == b"MP3"
    assert "xml:lang='ar-MA'" in sent[0]["content"].decode() and "ar-MA-JamalNeural" in sent[0]["content"].decode()
    assert speech.recognize(b"RIFF" + b"\0" * 2000, "ary") == "بغيت نسقي"
    assert sent[1]["params"]["language"] == "ar-MA"

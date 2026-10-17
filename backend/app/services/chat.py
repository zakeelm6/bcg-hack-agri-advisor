"""Adapter for the React app's Co-Pilot (frontend/lib/copilot.ts): it posts {question, photo, context, lang} and shows
{recommendation, why, steps, missing}. The content comes from the engine and the Copilot, never from the app's own guesses."""
from sqlalchemy.orm import Session

from ..schemas import requests as rq
from .advice import build_state
from .common import clean_lang
from .copilot_service import ask

TEXT = {
    "en": {"plan_b": "Plan B", "nothing": "Nothing needs doing right now.", "test": "A soil test in zone {z}",
           "sensor": "A moisture reading in zone {z}", "photo": "A close-up photo of the leaves", "spend_hint": "Record each purchase in Activities to keep this list true."},
    "fr": {"plan_b": "Plan B", "nothing": "Rien à faire pour le moment.", "test": "Une analyse de sol dans la zone {z}",
           "sensor": "Une mesure d'humidité dans la zone {z}", "photo": "Une photo de près des feuilles", "spend_hint": "Notez chaque achat dans Activités pour que cette liste reste juste."},
    "ar": {"plan_b": "الخطة البديلة", "nothing": "لا يوجد شيء يجب فعله الآن.", "test": "تحليل للتربة في المنطقة {z}",
           "sensor": "قياس للرطوبة في المنطقة {z}", "photo": "صورة قريبة للأوراق", "spend_hint": "سجّل كل شراء في الأنشطة لتبقى هذه القائمة صحيحة."},
    "ary": {"plan_b": "الخطة البديلة", "nothing": "ما كاين والو خاصك تدير دابا.", "test": "تحليل تربة فالمنطقة {z}",
            "sensor": "قياس ديال الرطوبة فالمنطقة {z}", "photo": "صورة قريبة للورق", "spend_hint": "سجل كل شرا فالأنشطة باش هاد اللائحة تبقى صحيحة."},
}
ORDER = {"irrigate": 0, "fertilize": 1, "inspect": 2}


def chat(db: Session, b: rq.ChatBody) -> dict:
    profile = (b.context or {}).get("profile") or {}
    lang = clean_lang(b.lang if b.lang != "en" else (profile.get("language") or "en"))
    tx = TEXT[lang]
    res = ask(db, b.question, None, lang)
    if res.get("intent") == "spend":   # a question about the farmer's own spending is not about a task
        return {"recommendation": res["text"], "why": tx["spend_hint"], "steps": [], "missing": []}
    st = build_state(db, lang)
    open_tasks = sorted((t for t in st["tasks"] if t["status"] == "open"), key=lambda t: (t["when_date"], ORDER.get(t["type"], 9)))
    if not open_tasks:
        return {"recommendation": res["text"], "why": tx["nothing"], "steps": [], "missing": []}
    t = open_tasks[0]
    zone = next((z for z in st["zones"] if z["code"] == t["zone_code"]), None)
    missing = []
    if zone and t["confidence"] != "High":
        if not zone["has_sensor"]:
            missing.append(tx["sensor"].format(z=zone["code"]))
        if not zone.get("soil_test"):
            missing.append(tx["test"].format(z=zone["code"]))
    if b.photo is None and t["type"] == "inspect":
        missing.append(tx["photo"])
    return {"recommendation": t["title"], "why": res["text"],
            "steps": [f"{t['what']} ({t['when_text']})", t["cost"], f"{tx['plan_b']}: {t['plan_b']}"], "missing": missing}

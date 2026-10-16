"""Language-model providers behind one small interface, plus the number check.

The model is OPTIONAL. Without configuration the app uses its rule engine's own texts. The model can only return
text: it cannot call tools, change a task or write to the database, and its keys never leave this server process.

Configure in farm-advisor/.env (never commit it):
    FA_LLM_PROVIDER=anthropic   ANTHROPIC_API_KEY=...   [FA_LLM_MODEL=claude-sonnet-5-5]
    FA_LLM_PROVIDER=openai      FA_LLM_API_KEY=...      FA_LLM_MODEL=<model>   [FA_LLM_BASE_URL=https://api.openai.com/v1]
    FA_LLM_PROVIDER=ollama      FA_LLM_MODEL=<local model>   (local server on this machine, works without internet)
"""
import json
import os
import re

import httpx

ENV_FILE = os.path.join(os.path.dirname(__file__), "..", ".env")


def _load_env():
    """Tiny .env reader (no extra dependency). Real environment variables win over the file."""
    try:
        for line in open(ENV_FILE, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass


_load_env()
TIMEOUT_S = 20.0


def provider_info():
    """What the Copilot can use right now. Never exposes keys."""
    prov = os.environ.get("FA_LLM_PROVIDER", "").lower()
    if prov == "anthropic" and os.environ.get("ANTHROPIC_API_KEY"):
        return {"mode": "model", "provider": "anthropic", "model": os.environ.get("FA_LLM_MODEL", "claude-sonnet-5-5"), "vision": True}
    if prov == "openai" and os.environ.get("FA_LLM_MODEL"):
        return {"mode": "model", "provider": "openai-compatible", "model": os.environ["FA_LLM_MODEL"], "vision": os.environ.get("FA_LLM_VISION") == "1"}
    if prov == "ollama" and os.environ.get("FA_LLM_MODEL"):
        return {"mode": "model", "provider": "ollama (local)", "model": os.environ["FA_LLM_MODEL"], "vision": os.environ.get("FA_LLM_VISION") == "1"}
    return {"mode": "engine", "provider": "none", "model": None, "vision": False}


def complete(system, user, image_jpeg_b64=None, max_tokens=500):
    """Returns the model's text, or None on any failure (the caller then falls back to the rule engine)."""
    info = provider_info()
    if info["mode"] != "model":
        return None
    try:
        if info["provider"] == "anthropic":
            content = [{"type": "text", "text": user}]
            if image_jpeg_b64:
                content.insert(0, {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_jpeg_b64}})
            r = httpx.post("https://api.anthropic.com/v1/messages",
                           headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"},
                           json={"model": info["model"], "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": content}]},
                           timeout=TIMEOUT_S)
            r.raise_for_status()
            return "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text").strip() or None
        base = os.environ.get("FA_LLM_BASE_URL") or ("http://localhost:11434/v1" if info["provider"].startswith("ollama") else "https://api.openai.com/v1")
        content = [{"type": "text", "text": user}]
        if image_jpeg_b64:
            content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + image_jpeg_b64}})
        headers = {"content-type": "application/json"}
        if os.environ.get("FA_LLM_API_KEY"):
            headers["authorization"] = "Bearer " + os.environ["FA_LLM_API_KEY"]
        r = httpx.post(base.rstrip("/") + "/chat/completions", headers=headers, timeout=TIMEOUT_S,
                       json={"model": info["model"], "max_tokens": max_tokens,
                             "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}]})
        r.raise_for_status()
        return (r.json()["choices"][0]["message"]["content"] or "").strip() or None
    except Exception:
        return None


# ---------- number check ----------
NUM = re.compile(r"\d+(?:[.,]\d+)?")


def _to_float(tok):
    return float(tok.replace(",", "."))


def allowed_numbers(facts):
    """Every number the facts contain, plus the usual ways of writing it (0.194 -> 19%, 19.4, 0.19, 0.2)."""
    allowed = set()
    for tok in NUM.findall(json.dumps(facts, ensure_ascii=False)):
        x = _to_float(tok)
        for v in (x, round(x, 1), round(x, 2), float(int(x)), round(x * 100), round(x * 100, 1)):
            allowed.add(round(float(v), 4))
    return allowed


def numbers_ok(text, facts):
    """True when every number in `text` exists in `facts`. Returns (ok, offending_numbers)."""
    allowed = allowed_numbers(facts)
    bad = sorted({tok for tok in NUM.findall(text) if round(_to_float(tok), 4) not in allowed})
    return (not bad), bad

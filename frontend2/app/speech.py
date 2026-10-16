"""Server-side voice through Azure AI Speech, so voice works in any browser and in Arabic.

The browser records a short WAV and sends it here; this server asks Azure to turn it into text. For the Copilot's
voice it asks Azure for an MP3 and the browser plays it. The Azure key stays on this server and is never sent to the page.
Audio is not stored. Without a key the app falls back to the browser's own speech (Chrome or Edge only).

Configure in farm-advisor/.env (never commit it):
    AZURE_SPEECH_KEY=...      AZURE_SPEECH_REGION=westeurope
    [AZURE_SPEECH_VOICE_AR=ar-MA-MounaNeural  AZURE_SPEECH_VOICE_FR=fr-FR-DeniseNeural  AZURE_SPEECH_VOICE_EN=en-US-JennyNeural]
"""
import os
import re
from collections import OrderedDict
from xml.sax.saxutils import escape

import httpx

from . import llm  # noqa: F401  (importing it loads .env)

LOCALES = {"en": "en-US", "fr": "fr-FR", "ar": "ar-MA"}
DEFAULT_VOICES = {"en": "en-US-JennyNeural", "fr": "fr-FR-DeniseNeural", "ar": "ar-MA-MounaNeural"}
MAX_AUDIO_BYTES = 2_000_000   # about 60 s of 16 kHz mono, the limit of Azure's short-audio recognition
MAX_TEXT = 1200
TIMEOUT_S = 15.0
_cache: "OrderedDict[tuple, bytes]" = OrderedDict()   # small memory cache: the same sentence is not paid for twice
_CACHE_MAX = 64


class SpeechError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def _config():
    key, region = os.environ.get("AZURE_SPEECH_KEY", "").strip(), os.environ.get("AZURE_SPEECH_REGION", "").strip()
    if not (key and re.fullmatch(r"[a-z0-9-]{3,40}", region)):
        return None
    return key, region


def status():
    ok = _config() is not None
    return {"available": ok, "provider": "azure" if ok else None, "langs": list(LOCALES) if ok else []}


def voice_for(lang):
    return os.environ.get(f"AZURE_SPEECH_VOICE_{lang.upper()}") or DEFAULT_VOICES[lang]


def recognize(wav: bytes, lang: str) -> str:
    cfg = _config()
    if not cfg:
        raise SpeechError("voice service is not configured", 503)
    if lang not in LOCALES:
        raise SpeechError("unsupported language", 422)
    if not wav or len(wav) < 1000 or len(wav) > MAX_AUDIO_BYTES or wav[:4] != b"RIFF":
        raise SpeechError("send a WAV recording under 60 seconds", 422)
    key, region = cfg
    url = f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
    try:
        r = httpx.post(url, params={"language": LOCALES[lang], "format": "simple"}, content=wav, timeout=TIMEOUT_S,
                       headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                                "Accept": "application/json"})
    except httpx.HTTPError:
        raise SpeechError("could not reach the voice service")
    if r.status_code in (401, 403):
        raise SpeechError("the voice service key was refused", 502)
    if r.status_code != 200:
        raise SpeechError(f"voice service error {r.status_code}")
    j = r.json()
    return (j.get("DisplayText") or "").strip() if j.get("RecognitionStatus") == "Success" else ""


def synthesize(text: str, lang: str) -> bytes:
    cfg = _config()
    if not cfg:
        raise SpeechError("voice service is not configured", 503)
    if lang not in LOCALES:
        raise SpeechError("unsupported language", 422)
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text or len(text) > MAX_TEXT:
        raise SpeechError(f"send between 1 and {MAX_TEXT} characters", 422)
    ck = (lang, text)
    if ck in _cache:
        _cache.move_to_end(ck)
        return _cache[ck]
    key, region = cfg
    ssml = (f"<speak version='1.0' xml:lang='{LOCALES[lang]}'><voice name='{escape(voice_for(lang))}'>"
            f"<prosody rate='-5%'>{escape(text)}</prosody></voice></speak>")
    try:
        r = httpx.post(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", content=ssml.encode("utf-8"), timeout=TIMEOUT_S,
                       headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                                "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "farm-advisor"})
    except httpx.HTTPError:
        raise SpeechError("could not reach the voice service")
    if r.status_code in (401, 403):
        raise SpeechError("the voice service key was refused", 502)
    if r.status_code != 200 or not r.content:
        raise SpeechError(f"voice service error {r.status_code}")
    _cache[ck] = r.content
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return r.content

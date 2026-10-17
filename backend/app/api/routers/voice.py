from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from ...core.ratelimit import voice_brake
from ...processing import speech
from ...schemas import requests as rq
from ...schemas.responses import SpeechStatusOut, SttOut

router = APIRouter()


@router.get("/api/speech/status", response_model=SpeechStatusOut)
def speech_status():
    return speech.status()


@router.post("/api/stt", response_model=SttOut)
async def speech_to_text(request: Request, lang: str = "en"):
    """Body: a WAV recording (16 kHz mono, under 2 MB). Returns the recognised text."""
    if not voice_brake.allow():
        raise HTTPException(429, "too many voice requests, wait a minute")
    wav = await request.body()
    try:
        return {"text": await run_in_threadpool(speech.recognize, wav, lang)}
    except speech.SpeechError as e:
        raise HTTPException(e.status, str(e))


@router.post("/api/tts", response_class=Response,
             responses={200: {"description": "MP3 audio", "content": {"audio/mpeg": {"schema": {"type": "string", "format": "binary"}}}}})
async def text_to_speech(b: rq.TtsBody):
    if not voice_brake.allow():
        raise HTTPException(429, "too many voice requests, wait a minute")
    try:
        audio = await run_in_threadpool(speech.synthesize, b.text, b.lang)
    except speech.SpeechError as e:
        raise HTTPException(e.status, str(e))
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})

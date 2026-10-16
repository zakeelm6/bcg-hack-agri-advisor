# Voice in Farm Advisor

How the Copilot talks and listens, what is tested, and what is not. Code: `backend/app/speech.py`, the voice routes in
`backend/app/main.py`, and the "Copilot: chat, voice in, voice out" section of `frontend/app.js`.

## 1. What the farmer can do

| Action | How |
|---|---|
| Ask by voice | Press the microphone. It records, stops by itself after a short silence, and sends the question to the Copilot. |
| Hear an answer | Speaker toggle in the Copilot header (read every answer), or the play button under one answer. |
| Hear today's tasks | The "Read my tasks" chip, or say it. Works from the advice saved on the device, so it also works with a poor connection. |
| Hear one task | "Listen" on the task page: action, moment and reason. |
| Talk without touching the screen | Talk mode (chat button in the Copilot header): it reads the tasks, listens, answers aloud, listens again. |

Voice commands (English, French and Arabic, understood on the device, no server call): read my tasks, repeat, stop.
Talk mode ends on "stop", when the mic is pressed, after two silences in a row, or on a microphone error.
A voice question goes through exactly the same Copilot as a typed one: same rule engine, same number check, same audit log.

## 2. Two voice paths

```
                      +-- server voice (Azure AI Speech) ----> any browser, Arabic included, needs a key and internet
mic / speaker  -------+
                      +-- browser voice (Web Speech API) -----> Chrome or Edge only, voices depend on the device
```

The page asks `GET /api/speech/status`. If a key is configured and the device is online it uses the server voice, otherwise
the browser voice. If the server voice fails in the middle of a conversation, the rest of the sentence is spoken by the browser.

### Server voice

Listening:
1. `getUserMedia` (echo cancellation and noise suppression on), recorded as raw audio and encoded in the page as a **16 kHz mono WAV**.
2. The recording stops by itself 1.4 s after the farmer stops talking, after 6 s with no speech (then "I heard nothing"), or after 20 s.
   Pressing the mic again sends what was said so far. Speech is detected by a fixed loudness threshold.
3. `POST /api/stt?lang=en|fr|ar` with the WAV. The server sends it to Azure short-audio recognition (languages en-US, fr-FR, ar-MA)
   and returns `{"text": "..."}`. Empty text means nothing was understood.
4. The text is sent to the Copilot like a typed question.

Speaking:
1. The answer is cut at sentence ends into chunks of about 240 characters.
2. For each chunk the page calls `POST /api/tts` (`{text, lang}`) and receives an MP3 (24 kHz, 48 kbps). The next chunk is fetched while the current one plays.
3. A stop (mic press, "stop", closing the panel) cancels what is playing and what is queued.

Default voices: `en-US-JennyNeural`, `fr-FR-DeniseNeural`, `ar-MA-MounaNeural` (speaking rate slightly slowed by 5 %).

### Browser voice (fallback)
- Listening: the browser's `SpeechRecognition` (English en-US, French fr-FR, Arabic ar-MA). Chrome and Edge send the audio to their own cloud speech service, so it needs internet.
- Speaking: `speechSynthesis`, one sentence at a time (some browsers cut long texts). The voice is the one matching the language code, otherwise any voice of the same language.
  If the device has no voice for the language (common for Arabic), the app shows "No voice for this language on this device".

## 3. Setup

In `backend/.env` (never commit it; the template is `.env.example`):
```
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope        # the region of your Azure Speech resource
# optional: AZURE_SPEECH_VOICE_AR=ar-MA-JamalNeural  AZURE_SPEECH_VOICE_FR=...  AZURE_SPEECH_VOICE_EN=...
```
Restart the server. The microphone needs `localhost` or HTTPS.

## 4. Server rules

| Rule | Value |
|---|---|
| Key | Stays on the server, never sent to the page, never in an error message |
| Audio | Not stored. Sent to Azure for recognition only |
| Recording size | At most 2 MB (about 60 s), must be a WAV |
| Text to speak | 1 to 1200 characters, escaped before it goes into the speech markup |
| Brake | 60 voice calls per minute, separate from the Copilot's 30 per minute |
| Cache | The same sentence in the same language is kept in memory (64 entries) so it is not paid twice |
| Errors | 503 not configured, 422 bad input, 429 too many, 502 Azure unreachable or key refused |

What is logged: the transcribed question is stored in the Copilot audit log like any typed question. The audio is not.

## 5. Messages the farmer can see under the mic

"Listening...", "I heard nothing", "Microphone is blocked", "Voice needs internet", "Voice needs Chrome or Edge",
"Voice needs a secure page (https)", "Voice did not work", "Talk mode on", "Talk mode off", "Stopped",
"No voice for this language on this device". All are translated to French and Arabic.

## 6. Tests and verification

Automated (8 tests in `tests/test_speech.py`, Azure faked): not configured returns 503, the key never appears in a response,
recognition sends the right language and key, bad audio or language is refused, speech returns audio and uses the cache,
text is escaped and length limited, Azure failures become clean errors, "no match" returns empty text.

Checked by hand in Google Chrome with a faked Azure: a generated tone was recorded, encoded as a valid 16 kHz WAV (2.2 s),
sent to `/api/stt`, the text became a Copilot command, the Copilot asked for speech and the audio played to the end exactly once.
The browser voice read English aloud for real. A scripted talk-mode run (tasks, listen, "Why?", answer, listen, "stop") ended correctly.

A bug found on the way and fixed: on the home page the Copilot panel sits outside the container that received the clicks, so
the mic, chips, speaker and send button did nothing. Clicks are now handled at the document level.

## 7. Not verified yet

- A real Azure key: real recognition quality, the real names of the voices, and the quality of `ar-MA`.
- A real person speaking into a real microphone, in a noisy field.
- Arabic and French end to end, and a phone (Android with Chrome, HTTPS).
- Whether Moroccan Arabic (darija) mixed with French is recognised well by `ar-MA`. The interface text is standard Arabic.

## 8. Known limits and ideas

- The loudness threshold for "the farmer is talking" is fixed. In a very noisy place it may never stop, or stop too early. A calibration step would help.
- The recorder uses an audio API that is deprecated (`ScriptProcessorNode`). It works today; the replacement is `AudioWorklet`.
- Azure short-audio recognition returns only the final text, up to about 60 s. No live words on screen and no streaming.
- The farmer cannot interrupt the Copilot by speaking; interrupting needs a press on the mic.
- Autoplay rules mean the first sound must follow a tap or click, so the Copilot cannot start talking by itself when the page opens.
- Offline there is no server voice and no speech recognition. Reading tasks aloud still works with the browser's own voices when the device has them.

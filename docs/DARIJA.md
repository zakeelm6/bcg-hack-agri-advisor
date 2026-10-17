# Darija (Moroccan Arabic) in Farm Advisor

Language code **`ary`**, written in Arabic script. It sits next to English (`en`), French (`fr`) and standard Arabic (`ar`).
The decisions and the numbers are identical in every language; only the wording changes.

**Status: written by an AI model, not by a native speaker. It needs a review by someone who speaks Darija before any real use.**
Spelling in Arabic script is not standardised, so a reviewer may prefer other spellings (for example "فالأرض" or "ف الأرض").

## What exists

| Part | Darija | How |
|---|---|---|
| React app: buttons, onboarding, tasks, Copilot panel, field, sell, GPS | 369 of 405 texts | `frontend/lib/i18n-ary.ts`; every text missing there reads the standard Arabic text |
| Language switch | "دارجة" in the header and on the welcome screen | `frontend/lib/i18n.ts` (`langs`, `isRtl`) |
| Advice and alerts from the engine (irrigation, fertilizer, inspection, frost, rain, harvest...) | all 59 texts | `backend/app/processing/engine.py` (`TEXTS["ary"]`), weekday names التنين، التلات، الأربع... |
| Copilot answers | all 25 texts | `backend/app/processing/copilot.py` (`CT["ary"]`), units "نهار / نهارين / أيام" |
| Copilot understands Darija questions | keywords | `detect()`: شحال، فوقاش، علاش، واش نتسنى، شنو ندير، ما قدرتش، مريضة... |
| React Co-Pilot route `/api/chat` | yes | `backend/app/services/chat.py` |
| Voice | Azure `ar-MA` (Moroccan Arabic). Default voice `ar-MA-JamalNeural` (standard Arabic uses `ar-MA-MounaNeural`) | `backend/app/processing/speech.py`; change with `AZURE_SPEECH_VOICE_ARY` |
| Right to left layout | yes | `isRtl()` |

Fallback chain everywhere: **Darija, then standard Arabic, then English**. A text with no Darija version is never blank.
Anything not covered (some satellite and farmer-profile notes) reads in standard Arabic.

## Tests and checks
- `backend/tests/test_darija.py` (9 tests): same texts as standard Arabic, same placeholders, fallback order, weekday names, same numbers and decisions in `/api/state`,
  Darija questions detected, Copilot and chat answer in Arabic script without inventing a number, Darija voice uses `ar-MA`.
- `node frontend/lib/i18n.check.mjs`: every Darija key exists and has the same `{placeholders}` as English.
- Checked in a browser against the real backend: welcome screen with four languages, Darija headline, home screen with the engine's task in Darija, Copilot chips in Darija, right to left.

## What this does not do
- **Voice recognition is Azure's `ar-MA`, not a Darija model.** A test with synthetic speech understood two of three Darija sentences well and mistook "واش" for "واشنطن" in the third.
  Real farmers, real accents and a noisy field are not tested.
- **The voices read Arabic text in a Moroccan accent.** They do not make standard Arabic into Darija: the Darija comes from the text.
- **Darija in Latin letters** ("bghit nsqi") and mixed Darija and French are not supported, in writing or in speech.
- **The Copilot's intent detection is keyword based.** Many natural Darija sentences will not match a keyword and get the help text.
  With a language model configured, the model is asked to answer in Darija (see `LANG_NAME` in `copilot.py`), untested with a real model.
- **The legacy web app (`frontend-legacy/`) has no Darija.** Only the React app does.
- Dates use the Arabic (Morocco) calendar formatting with Latin digits, as for standard Arabic.

## How to improve it
1. Have a Darija speaker read `frontend/lib/i18n-ary.ts`, `TEXTS["ary"]` in `engine.py` and `CT["ary"]` in `copilot.py`, and fix wording and spelling.
2. Collect real Darija questions from farmers and add their words to `detect()`.
3. Add the 36 UI texts still read in standard Arabic if the reviewer wants them different.
4. Test the microphone with real speakers; if recognition is weak, consider a vocabulary hint for farm words (Azure phrase lists).

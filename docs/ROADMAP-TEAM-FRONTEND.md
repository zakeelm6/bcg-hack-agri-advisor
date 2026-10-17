# Roadmap: bring the engine, the sensors and the polish to the team's frontend (growmate), his way

Written for 3zden's React app (`frontend/`, Next.js 15, React 19, Tailwind 4) and the backend added in `backend/`.
It follows the same arc as our own roadmap (align, backend, sensors and satellite, frontend, voice, offline, deploy, harden),
but each step is shaped to what this app already is. Sizes: S (hours), M (about a day), L (several days).

## 1. What this app already is (keep it)

| Trait | What it means for every step below |
|---|---|
| **Picture first, one question per screen.** Six questions with pictures that move on by themselves, plus a welcome screen. | New screens use big pictures, few words, one primary action. No dashboards, no tables of numbers on the first screen. |
| **Voice first.** Each question is read aloud; the Co-Pilot starts on a big microphone. | Anything new must be speakable and listenable. |
| **Three tabs: My Farm, Co-Pilot, Activities.** | Keep these three. New content goes inside them, not into six new tabs. |
| **Local first.** The farmer's profile, tasks, activities and chat live in the phone (`localStorage`, key `growmate`). | The phone stays the owner of the farmer's own data. The server adds engine data on top and receives what the engine needs. |
| **One dictionary** (`lib/i18n.ts`, rows of `[en, fr, ar]`, Darija in `lib/i18n-ary.ts`), answers stored as dictionary references so they follow language switches. | Keep that style. No i18n library. Four languages, right to left done with logical CSS. |
| **Own identity:** a serif title face, deep green on warm paper, team icon set (`lib/farm-icons.ts`), photos. | Polish it; do not replace it with our look. |
| **Small:** about 1,700 lines, no state library. | Add libraries only when they remove more code than they add (the data layer is the one justified addition). |

## 2. Where we are (branch `integrate/engine`, commit 9d4087c, not pushed)

Done: `backend/` added (95 tests); the Co-Pilot asks the engine (`POST /api/chat`), with his local keyword stand-in as the offline fallback;
Darija as a fourth language (166 of 174 texts); right to left and locale helpers; `docs/INTEGRATION.md`.
Verified in a browser: Darija welcome, the six questions in Darija, an engine answer in his answer card.
Not done: everything below.

## 3. The gap that matters most (read before the steps)

The engine reasons about **one demo parcel near Berrechid with 4 zones**. This app asks the farmer for **their own town, crop, planting date and area**.
Until the engine works on the farmer's own field, the advice is about the demo parcel, not about their land. Two consequences shape the plan:

1. **Be honest on screen** until their field is processed: a small "demo field" label on engine advice, and a clear "waiting for satellite data for your field" state.
2. **Make "my field" real** (Step 4): the boundary he lets the farmer draw (Measure view) and the GPS position become the input of the engine.

A second gap: the backend has **one field and no login** (`field_id = 1`). His app has one farmer per phone. Step 8 gives each phone its own data.

## 4. Steps (each step is a pull request; 3zden reviews anything that changes a screen)

### Step 0: land what exists (S)
- Push `integrate/engine`, open the pull request, let 3zden and Meryy4 read `docs/INTEGRATION.md`.
- Decide with Meryy4 what happens to the root `sensors/` and `satellite/` (the backend carries tested copies in `backend/app/processing/`): one copy, moved by pull request.
- Done when: the branch is merged or agreed, CI (`backend.yml`) runs on GitHub.

### Step 1: his onboarding feeds the engine (M) - DONE on branch `step1/profile-to-engine` (see section 9)
- After the six questions (and on every "Edit"), send the answers to `POST /api/farmer` (crop, planting date, area, irrigation, challenge, position). Keep the local copy as the source of truth; if offline, send later.
- Show what the engine actually used ("Used by the advice: crop, planting date, area"): the backend already returns it (`profileApplied`).
- Fix the geolocation button while here: guard `navigator.geolocation`, ask for high accuracy with a fallback, timeout on the town lookup, a different message for "permission refused".
- Privacy: the town lookup sends the position to a third party. Offer the lookup through our backend, or say it plainly.
- Done when: changing the crop in "Edit" changes the engine's advice the next time the Co-Pilot answers.

### Step 2: "Do this now" inside My Farm (M) - DONE on branch `step2/do-this-now` (see section 9)
- On My Farm, above his weather: one large card with the engine's top task as a picture, a short title, when, and how sure we are (a three-step meter with a word). One tap opens the detail.
- Replace his local "Today" list by the engine's tasks (his checkbox row stays, fed by `/api/state`). Keep his `Task` shape in the UI; map the engine fields to it.
- Task detail, picture-first: what, when, cost, plan B behind "Why?", and two big buttons: **Done** and **Can't** (reasons as pictures: no water, no time, not needed). **Undo** for six seconds after Done.
- Done links to his **Activities**: marking an irrigation task done adds a "Watered" activity automatically; the farmer only confirms the amount.
- Done when: a farmer can do their day without opening the Co-Pilot, and what they did shows in Activities.

### Step 3: his Activities teach the engine (M) - DONE on branch `step3/activities-teach-engine` (see section 9)
- Send the activities that matter to the engine (watered, sprayed, fertilised, spent) with a small additive contract change (`POST /api/activities`; ask before changing `docs/API_CONTRACT.md`).
- The engine uses real watering records instead of guessing the last irrigation; "Costs" questions in the Co-Pilot use the real list.
- Done when: after recording "watered 20 mm", the engine no longer asks to irrigate the same day.

### Step 4: "My land" becomes the engine's field (L) - DONE on branch `step4/own-field` for the zones and the pictures (see section 9)
- Keep his three views (Photo, Measure, 3D) and add a fourth, **Zones**: the Sentinel-2 picture with the vigor of each part of the field and the persistent anomalies, built from our land view, in his visual style (big, few words, honest "real / simulated" label).
- The field the engine uses becomes the farmer's: the boundary drawn in Measure (or a square from the GPS and area) is sent to the backend, which splits it into zones.
- Backend work: create a field and zones from a polygon (today they are a fixed 2 by 2 grid); fetch Sentinel-2 pixels for that polygon on demand (a background job, cached, a few minutes the first time); until it finishes the engine answers from weather and soil tests only and says so.
- Be honest about cost and limits: free Sentinel-2 data, cloud cover leaves gaps, one clear date may take days.
- Done when: a new farmer outlines their field and, after the job, sees real zones for that field.

### Step 5: confidence and data quality, shown his way (M) - DONE on branch `step6/voice` (see section 9)
- The three-step "how sure" meter and one honest line wherever advice appears ("based on the satellite only", "a soil test would make this surer").
- "Sensor unreliable" and "satellite alert" become calm alerts with a picture and one action ("Add a soil test", "Go and look at this spot").
- The soil test is a picture-first form in Activities (pH, organic matter, moisture), reusing his stepper style.
- Done when: a faulty simulated sensor produces a clear "not sure, please test" instead of a dose.

### Step 6: voice, his way plus ours (M) - DONE on branch `step6/voice` (see section 9)
- Keep his behaviour (each question read aloud, big "Tap and speak").
- Replace his browser-only voice with our `useVoice` hook: Azure server voice first (works in any browser, Arabic and Darija included), browser as fallback, visible states, talk mode, voice commands ("read my tasks", "repeat", "stop").
- Make every new screen of Steps 2 to 5 readable aloud with one button.
- Done when: a farmer with a phone that has no Arabic voice still hears the advice in Arabic or Darija, and the mic works in Chrome and in Safari.

### Step 7: offline and weak network (M)
- He is already local first; add what is missing: a service worker so the app opens with no network, a queue for the writes of Steps 1 to 3 (profile, task status, activities, soil tests) replayed through `POST /api/sync`, and a calm banner ("saved on your phone, will be sent").
- The Co-Pilot already falls back to his local stand-in; label that answer ("answered on the phone, without the satellite").
- Done when: in airplane mode a farmer opens the app, sees saved advice, marks a task done, and it arrives when the network returns.

### Step 8: one farmer, one field, one phone (L)
- Backend: farmer and field tables keyed by an anonymous device token created on first launch (no login for the demo), every route scoped to it. Later: a phone-number login for farmers who change phones, and a cooperative agent role.
- This is the step that turns the demo into a product and it touches every route, so do it before real users, behind a migration.
- Done when: two phones with different fields see different advice.

### Step 9: professional polish in his identity (M to L)
- Use `docs/prompts/opencode-ux-pro.md` but re-aimed: keep the serif and the green, formalise them as tokens; build the small component set; dark and high-contrast modes; the empty, loading, error and offline states; the language switcher that fits on a phone; Lighthouse targets.
- Known rough spots to fix first: the Co-Pilot chips send an English question shown in the user's bubble; the four-language switcher is cramped; the welcome and onboarding screens are good but the Zones and task screens must reach the same standard.
- Done when: all screens in four languages at 390 px and 1440 px pass the checklist, with before and after screenshots.

### Step 10: deploy on Azure (M)
- His `Dockerfile` (Next.js standalone) and a backend image, two Container Apps, a managed database, secrets in Key Vault, Azure AI Speech key, HTTPS only. Turn authentication on before anything is public.
- `.github/workflows`: backend tests and contract check (exists), frontend type check and build, deploy on merge.
- Done when: the whole scenario below runs on a public URL from a phone.

### Step 11: harden (M)
- End-to-end tests of the scenario (Playwright), tests of the offline queue and the voice hook, a real-phone checklist (Android Chrome, slow network, Arabic and Darija voice, noise), a native Darija and Arabic review of every text, a short privacy page (position goes to the weather service, the town lookup, the map imagery providers), the honest-limits slide.

## 5. The scenario that means "it works" (for his app)
1. A new farmer opens growmate on a phone, picks Darija; the welcome screen and each question are read aloud.
2. They answer six picture questions; the position is found (or typed).
3. My Farm shows their field, the weather, and one big "do this now" card with how sure we are.
4. They tap "Why?" and hear the reason in Darija; they tap the mic and ask "واش نتسنى نهارين؟" and hear a simulated answer.
5. They mark the task done; an "I watered" activity appears; they undo and redo it.
6. A faulty sensor or a missing soil test shows a calm "not sure, please test" with one action.
7. A persistent patch of poor crop shows in the Zones view and creates a "go and look" task.
8. In airplane mode the app opens, shows saved advice, accepts actions; they arrive when the network returns.
9. A second phone with another field sees different advice.
10. All of it runs on the public URL behind HTTPS, with automated tests green.

## 6. Working rules for this repository
- One branch and one pull request per step, named `step<N>/<name>`. Small commits. Nobody pushes to `main` directly.
- 3zden owns screens and wording; the backend owner owns routes and the contract (`backend/openapi.json`, `docs/API_CONTRACT.md`). A contract change is additive and reviewed by both.
- The frontend never computes a number the engine decides. Honest labels ("real", "simulated", "not validated") stay.
- Keep his conventions: the `[en, fr, ar]` rows, Darija overrides in `i18n-ary.ts`, `node lib/i18n.check.mjs` and `node_modules/.bin/tsc --noEmit` before every push, `npm run dev` (it copies the 3D map worker).
- No secrets in the repository; keys in `backend/.env` and in the cloud. No tool or assistant signatures in commit messages.

## 7. Decisions needed
| Question | My default |
|---|---|
| Keep the phone as owner of the farmer's data, with the server as a second copy? | Yes (local first) |
| Anonymous device token for the demo, phone-number login later? | Yes |
| Fetch Sentinel-2 for each farmer on demand, or only for demo fields? | On demand with a clear waiting state, demo field until then |
| Move the town lookup through our backend for privacy? | Yes, in Step 1 |
| Who reviews the Darija and Arabic texts? | A native speaker from the team before the demo |
| Merge our two frontends into one repository layout after Step 9? | Yes: his app is the product; our legacy and our React shell stay as references until parity |

## 8. Risks
| Risk | Reduce it by |
|---|---|
| The engine advises about the demo parcel while the farmer thinks it is their land | The "demo field" label now; Step 4 as soon as possible |
| Step 4 and Step 8 are the two big pieces | Do Steps 1 to 3 first: they already make the app useful on the demo field |
| His voice-first screens regress when ours replaces them | Keep his tests scenario (Step 11) and review each screen with him |
| Two code bases drift | One repository, pull requests, the contract test, CI on both sides |
| Satellite jobs are slow or empty (clouds) | Honest waiting and "no clear picture yet" states; weather-only advice meanwhile |

## 9. Progress log

### Step 1 done: his onboarding feeds the engine
- The answers (town, crop, planting date, area, irrigation, worry, position) are sent to `POST /api/farmer` whenever the profile is saved (end of the six
  questions, "Edit", drawing the field boundary). The phone keeps its copy; if the server cannot be reached the profile is marked "waiting to be sent" and goes
  when the connection is back (the `online` event, or the next start). A refusal by the server is not retried in a loop.
- My Farm shows what the engine did, in the farmer's language: "Used by the advice: main crop, planting date, field size", then the honest notes the server
  returns (the position still belongs to the demo parcel; irrigation method and main worry are stored but not used by the rules yet).
- The geolocation button is hardened: a missing `navigator.geolocation` no longer leaves it stuck on "Finding you..."; the GPS is asked first with high accuracy and a rough
  position is accepted if it does not answer in 10 s; a refusal is final and has its own message (how to allow it); the town lookup waits at most 6 s, then shows coordinates.
- Privacy: the town lookup goes through `GET /api/geo/place` (our server asks the place-name service, with a small cache). Without a backend the app asks the service directly, as before.
- New files: `frontend/lib/api.ts` (backend client), `backend/app/services/places.py`, `backend/app/api/routers/places.py`, `backend/tests/test_places.py` (5 tests).
- Checked: backend tests (100), TypeScript, the Darija check, and in a browser against the running backend: GPS with a failed first try then a rough position (2 calls),
  refusal (1 call, own message), no geolocation (message, button usable, no error), the crop changed in the engine after onboarding (Tomato, then Wheat after an edit),
  an edit made while the server was stopped stayed on the phone and reached the engine after the connection came back, and the notes shown on My Farm.
- Not done in Step 1: the engine still works on the demo parcel (Step 4); irrigation method and main worry do not change the rules yet; the profile is one per server (Step 8).

### Step 2 done: "Do this now" inside My Farm
- A new card at the top of My Farm (`frontend/app/farm/engine-card.tsx`, data in `frontend/lib/engine.ts`): the engine's most urgent task as a picture (water, fertilizer or a visit),
  its title, when, and how sure we are (three bars plus a word, never colour alone), a speaker button that reads it aloud, a "Why?" fold-out (why, cost, how sure and why, plan B),
  and two big answers: **Done** and **Cannot do it** (then three picture reasons: no water or product, no time, not needed). "+N more today" lists the other tasks, each opening the same way.
  When there is nothing to do it says so calmly.
- **Done** adds the matching entry to his Activities by itself (watered, or other work for fertilizer) and shows "Done: ..." with **Undo** for 6 seconds (undo reopens the task and removes the entry).
  **Cannot do it** stores the reason with the answer (an observation on the server) for the next steps.
- The farmer's answers go through the same replay route as everything offline (`POST /sync`). The screen changes at once; if the server cannot be reached the answer waits in a small queue on the phone
  (`growmate-queue`) and is sent, in order, when the connection is back. The last advice is kept on the phone (`growmate-engine`) and shown with "Saved advice (no connection)".
- Honest label under the card: "This advice is for the demo field (satellite picture and simulated sensors)" until Step 4 makes the field the farmer's own.
- **Decision that differs from the plan:** his own "Today" list (tasks the farmer saves from the Co-Pilot) stays as it is, below, instead of being replaced; the engine's tasks sit above it in the new card.
  Two lists of different origin, one on top of the other, lose nothing; merging them is a design choice for Step 9.
- Without `NEXT_PUBLIC_API_URL` the card is not shown and the app is exactly what it was.
- Checked in a browser against the running backend: card on My Farm, details, Done (server 1:done, activity added), Undo (server back to open, activity removed), Cannot do it with a reason
  (server: skipped), the hero moving to the next task each time, an answer given while the server was stopped (queued, then delivered after the `online` event, queue empty), a reload with the server down
  (cached advice and the "saved advice" note), and Darija right to left. TypeScript, the Darija check, a production build and the backend tests pass.
- Not done: a task answered on one phone is not shown on another (Step 8); no automated front-end tests yet (Step 11); the activity entry keeps the language the task title had when it was done.

### Step 3 done: his Activities teach the engine
- Every entry the farmer records in Activities (watered, sprayed, planted, spent money, other work), and the entries the "Done" button of the card creates, is sent to the backend
  (`POST /api/activities`, through the same offline queue as the task answers, `lib/queue.ts`), with its own id so a retry never duplicates it and "Undo" removes it on the server too.
  Entries written before the backend existed are sent once.
- **The engine uses real watering instead of guessing.** A watering recorded in the last 2 days (for one zone, or for the whole field when the farmer did not say which) makes the engine
  wait for that zone, and the card says so ("Watering recorded. You recorded watering on Saturday. No new watering is advised for 2 days, so the soil has time to show it."), in four languages.
  Undoing the entry brings the advice back.
- **A related bug fixed:** a task the farmer had marked done or skipped never came back, because the same task key kept its old answer forever. Now, when the same need returns on a later
  day, it is a new occasion and the task opens again (same day: the answer already given stays).
- **The Copilot answers "How are my costs looking?" from the farmer's real list** (total, number of entries, the biggest one), with the number check; a question about what a task costs is still
  a task question. The farmer's amounts have no currency (the app does not ask for one), so none is shown.
- New: `activities` table and migration `0004`; routes `GET/POST /api/activities`, `DELETE /api/activities/{client_id}`; sync actions `activity` and `activity_remove`;
  `backend/tests/test_activities.py` (10 tests); test fixture that resets the rate limits (110 tests in all).
- Checked in a browser against the running backend: the card asked to water zone D; after "Watered" was tapped in Activities the card dropped the irrigation and showed the watering note;
  "Spent money 300" reached the server and the Co-Pilot answered with that real figure.
- Follow-up, done in the same step: see "Step 3 follow-up" below. Still open: an entry edited on one phone is not seen on another (Step 8).

### Step 3 follow-up: the amount of water, a real moisture estimate, a currency
- **How much water.** Tapping "Watered" in Activities now asks with pictures: a little (10 mm), normal (20 mm), a lot (30 mm), or "not sure". The card's **Done** knows the amount itself:
  tasks now carry the quantity the engine decided (`qty` and `unit`: mm of water, kg of nitrogen per hectare; migration `0005`), and the entry it creates has that many millimetres and the zone.
- **Recorded water becomes a moisture estimate.** With an amount, the engine adds `mm / 300 mm` of root layer to the moisture of that zone, takes away the crop's water use since (the forecast's
  evapotranspiration per day; rain is ignored, which errs towards watering), and does so only for readings taken *before* the watering (a sensor reading or soil sample from after it already contains the water).
  The zone's confidence drops from High to Medium (a reading plus a calculation), its reason says "Counts your 20 mm of watering on Saturday", and when the estimate lifts the zone above the watering threshold the
  note says so with the number ("The topsoil is now estimated at 28% (watering is advised below 23%), so none is needed yet."). A small watering (5 mm) leaves the task in place.
  Without an amount the engine still just waits 2 days, as before.
- **Currency.** Amounts are shown as money in the app (`MAD 300`, Latin digits in Arabic and Darija; `NEXT_PUBLIC_CURRENCY` to change) and the Copilot says "300 MAD" (`FA_CURRENCY` on the backend). The
  farmer is not asked for a currency: the pilot is in Morocco. Changing it for another country is a setting, not a code change; two currencies in one deployment is not supported.
- Tests: 116 backend tests (16 for activities, including fading after five days, a reading taken after the watering not corrected twice, and the currency). Checked in a browser: the picture chooser,
  20 mm reaching the server, zone D going from 21% to 27.7%, the irrigation task gone, the note with the estimate, and "MAD 300" in the history.
- Honest limits of the estimate: it is a one-layer bucket model with typical constants (300 mm root layer, forecast evapotranspiration), not a calibrated soil model; infiltration, runoff,
  drip losses and rain since the watering are not modelled. It is meant to stop the engine from asking for water that was just given, and to say how it reasoned, not to replace a sensor.

### Step 4 done: "My land" becomes the engine's field
- **The engine now works on the farmer's own field.** When the farmer gives a position (GPS, or the outline drawn in Measure) and a size, the backend replaces the demo parcel by a square of that area centred on it,
  cut into the four zones A B / C D. The weather follows the position at once (it used to stay on the demo parcel). A zone has no vigor (`ndvi` null) until a satellite picture of *this* field has been read,
  and the engine then runs no vigor rule (no fertilizer or "inspect" task from vigor) and says so instead of using the demo parcel's numbers.
- **Satellite pictures on demand.** A background job runs `scripts/fetch_satellite.py --side ... --out-dir backend/data/own` in the satellite environment (`backend/.venv-sat`, or `FA_SAT_PYTHON`; `requirements-sat.txt`),
  reads the pixels of that square from the free Sentinel-2 catalog (only the field's pixels), drops clouds and shadows, and the API reads the result into the zones, the vigor-over-time series and the problem-spot detector.
  `GET /api/field` reports `pending`, `ready`, `failed` or `none` (not set up on this server) with a plain note, `POST /api/field/satellite` tries again, `GET /api/field/picture` serves the true-colour picture.
  A job survives only as long as the server: after a restart a download that was running is marked failed ("interrupted") and can be retried.
- **A new view in "My land": Zones.** The picture around the field, zoomed to it, with the four zones coloured by vigor, each with its letter, number and a word (strong, medium, weak: never colour alone), the persistent problem
  spots as dashed squares, the picture date, and honest messages: demo parcel, getting the pictures (minutes), failed with "Try again", not set up. It keeps the last view on the phone when offline.
  The "do this now" card's note follows whose field it is. "Used by the advice" now lists the field position.
- **Checked for real, not only in tests.** With the satellite environment and the network, a farmer at 33.2716, -7.5819 with 2.4 ha got their own field: the job took about five minutes, read 16 dates, the picture of 23 August and
  the zones A 0.23, B 0.20, C 0.62, D 0.37 (a mostly bare field: not the irrigated demo parcel's 0.8), and the engine answered with "Inspect point P" for it; the Zones view in the browser shows exactly this over the picture.
  Backend: 126 tests (10 new in `test_own_field.py`, the download itself is faked in them); TypeScript, the Darija check and a production build pass.
- **Honest limits.** The outline gives the centre and the size only: pixels outside the outline are not masked and the square, not the polygon, is analysed. The zones are always a 2 x 2 grid. The first picture takes minutes and
  needs clear dates in the last months (cloud cover can leave nothing). One field per server (Step 8 for one per phone). The soil-moisture sensors are still the two simulated ones of the demo, now attached to zones A and B of the farmer's field.
  Crop type is still not read from the satellite. A field outside the satellite's reach (offline server, no environment) works on weather and sensors only and says so.

### Step 6 done: voice, his way plus ours
- **One voice layer for every screen** (`frontend/lib/voice.ts`). Every existing button (onboarding questions, "Listen" on the card, Co-Pilot answers) now uses the server voice first (Azure, `/api/tts` and `/api/stt`) and the browser voice as a fallback,
  so a phone with no Arabic voice still hears Arabic and Darija (Darija uses `ar-MA`, the Jamal voice). The server says whether it has a voice (`/api/speech/status`); without it, or offline, the browser voice is used and the app behaves as before.
- **Speaking:** text is cut at sentence ends, the next piece is fetched while the current one plays, a stop cancels what plays and what is queued, and a failure in the middle is finished by the browser voice (never silence).
- **Listening:** the page records a 16 kHz WAV, stops by itself 1.4 s after the farmer stops talking (6 s with no speech, 20 s at most), a second tap sends what was said so far. Chrome, Safari and Firefox work because the browser only records.
- **Talk mode and spoken orders in the Co-Pilot:** a "Talk mode" button (listen, answer aloud, listen again; ends on "stop", a tap, an error, or two silences) and a "Read my tasks" button that reads the engine's open tasks.
  Orders understood on the phone in four languages: read my tasks, repeat, stop. A long sentence is never taken for an order.
- **Calm messages** under the mic: blocked microphone, nothing heard, needs https, needs a connection, did not work (four languages).
- **Checked:** TypeScript, Darija check, `node lib/voice.check.mjs` (cutting, WAV header and resampling, orders), and for real the Azure voice from the running API: a Darija sentence came back as 24 kHz MP3 and the CORS preflight for the recording route passes.
- **Not verified:** a real microphone in a browser and on a phone (recording, silence threshold in noise), Safari autoplay, and a native Darija listener on the voice. The recording uses a script processor node (deprecated but works everywhere).

### Step 5 done: confidence and data quality, shown his way
- **Calm alert cards under the "do this now" card** ("Also worth knowing"): each has an icon, a title, one sentence and one action. A sensor or sample alert offers "Add a soil test" (opens the form on that zone), a vigor alert offers "See the zones", weather alerts have no button.
  A vigor alert that already is an open task is not said twice.
- **One honest line per data source** under the card: the plant vigor of the demo field is simulated, the soil sensors are simulated, "based on the satellite only, a soil test would make it surer" for a real picture, "no satellite picture yet" for an own field without one.
- **A picture-first soil test in Activities** (zone A to D chips, pH, organic matter, moisture, one value is enough), sent through the same offline queue as everything else (`soil_test` action). Checked for real: pH 6.8 and moisture 24 % for zone D removed
  "Soil sample needed in zone D" and the estimated irrigation task from the engine's answer.
- The three-step "how sure" meter and the reason were already on every task (Step 2); a faulty sensor gives "not sure, please test" and never a dose (backend rule, tested).
- Not done: a history of soil tests in the app (the engine keeps them; the phone does not list them yet), editing or deleting a test.

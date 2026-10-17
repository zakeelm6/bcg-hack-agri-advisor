# Sanabils (سنابل): the idea, what we are building, and the sandbox

BCG Platinion Hackathon 2026, theme "Fighting world hunger", Team 2. State on 17 October 2026.
Diagrams are written in Mermaid (rendered by GitHub); PNG copies are in `docs/diagrams/`.
For the detailed structure and the justification of each choice see [`TECHNICAL.md`](TECHNICAL.md).

## 1. The idea

**Sanabils** tells a small Moroccan farmer **what to do today, why, how sure we are, and the plan B**, by voice, in Darija, Arabic, French or English, on a cheap phone that is often offline.

It reads the land for him: real Sentinel-2 satellite vigor, Open-Meteo weather, soil sensors if he has them (otherwise a rain / ET0 water balance), and his own soil tests. **The code decides every number; the AI only explains**, and everything on the screen is labelled real, simulated or not validated. It then follows up (Done, Can't and why, how does it look), so the advice learns from the field.

Why it matters for the theme: on small farms the lever is water and fertiliser used at the right moment; one wrong decision costs a season's income, and the farmer most exposed is the one who reads little and has no agronomist.

```mermaid
flowchart LR
    subgraph IN[What we read]
        SAT[Sentinel-2 vigor<br/>real, every 5 days]
        WX[Open-Meteo<br/>forecast + past 7 days]
        SEN[Soil sensors<br/>if the farmer has them]
        SOIL[Soil tests<br/>entered by the farmer]
        PROF[Farmer profile<br/>crop, sowing date, area, water]
    end
    ENGINE[[Rule engine<br/>decides every number]]
    OUT[Today's tasks<br/>what, when, why, cost,<br/>confidence, plan B]
    VOICE[Voice + plain words<br/>ar / ary / fr / en]
    FARMER((Farmer))
    FEED[Done / Can't / How does it look]
    IN --> ENGINE --> OUT --> VOICE --> FARMER --> FEED --> ENGINE
```

![01-idea](diagrams/01-idea.png)

## 2. What we are building (what exists today, on `main` and on Azure)

| Part | What the farmer gets |
|---|---|
| **Landing + onboarding by voice** (`/`, `/start`) | 8 questions answered by speaking, pictures or typing; the field found on a map |
| **Simple mode** (default: `/today`, `/field`, More) | The land as A / B / C / D; tap a zone to **hear what to do there**; one big card in plain words; Done / Can't; Speak; Listen to today; Call my advisor. No numbers unless asked |
| **Full mode** (Home, Field, Tasks, Sell, Alerts, Me) | Layers (vigor, moisture, temperature, anomalies), tasks with why / cost / confidence / plan B / what-if, season plan, prices, alerts |
| **Setup** (`/setup`) | Sensors or satellite-only, connection mode, advisor phone, simple or full, look, keep for offline |
| **Engine** | Tasks, season plan, per-task verifier (confirmed / adjusted / escalated), daily briefing, water balance without sensors |
| **Voice** | Azure AI Speech on the server (TTS + STT) in the four languages; browser voice as fallback |
| **Copilot** | Facts → intent → engine draft → optional model rewrite → **number check**; today in engine mode (no model key configured) |
| **Offline** | Installable PWA; reads cached with their age; writes queued and replayed through `/api/sync` |
| **Delivery** | Two Docker images, CI green, CD pipeline built (waiting for one Azure role) |

### 2.1 The farmer's journey

```mermaid
flowchart TD
    L[Landing page<br/>choose language, Go] --> S[Onboarding, 8 questions<br/>voice / pictures / typing]
    S --> T[Today<br/>land A B C D + one card in plain words]
    T -->|tap a zone| Z[Hear what to do in that zone]
    T -->|Listen| B[Daily briefing read aloud]
    T -->|Speak| C[Copilot: why, what if I wait, costs, photo]
    T -->|Done| R[How does it look? better / same / worse]
    T -->|Can't| K[Why not? no means / no time / not needed]
    T -->|escalated task| A[Check the soil or Call my advisor]
    R --> E[(Observations feed<br/>tomorrow's advice)]
    K --> E
    T -->|See the numbers| F[Full task page: why, cost, confidence, plan B]
```

![02-farmer-journey](diagrams/02-farmer-journey.png)

### 2.2 How a task is decided, verified and spoken

```mermaid
flowchart LR
    subgraph SRC[Sources]
        A1[Sentinel-2 NDVI per zone<br/>+ anomaly cells]
        A2[Open-Meteo<br/>rain, ET0, 7-day forecast]
        A3[Sensors with QC<br/>or water balance]
        A4[Soil tests]
        A5[Season plan<br/>crop stage from sowing date]
    end
    EST[estimate_moisture] --> ADV[build_advice<br/>irrigate / fertilise / inspect / harvest]
    A1 --> ADV
    A2 --> EST
    A3 --> EST
    A4 --> ADV
    A5 --> VER
    ADV --> VER[verify_task<br/>confirmed / adjusted / escalated]
    VER --> TASK[Task: what, when, why, cost,<br/>confidence, plan B, label real/simulated]
    TASK --> PLAIN[Plain words, no units<br/>lib/plain.ts]
    TASK --> BRIEF[Daily briefing]
    PLAIN --> TTS[Azure Speech TTS]
    BRIEF --> TTS
```

![03-decision-flow](diagrams/03-decision-flow.png)

### 2.3 Where the AI is, and where it is not

```mermaid
flowchart LR
    Q[Farmer's question<br/>voice or text] --> STT[Azure Speech STT]
    STT --> FACTS[make_facts<br/>the engine's numbers as JSON]
    FACTS --> INT[detect intent<br/>why / what-if / cost / spend / diagnose]
    INT --> DRAFT[engine_answer<br/>deterministic draft]
    DRAFT --> HAS{model key<br/>configured?}
    HAS -- no --> ENG[Answer = engine text]
    HAS -- yes --> LLM[LLM rewrites the draft<br/>Anthropic / Azure OpenAI / Ollama]
    LLM --> CHECK{every number<br/>exists in the facts?}
    CHECK -- yes --> MOD[Answer = model text]
    CHECK -- no --> ENG
    ENG --> LOG[(CopilotLog + /api/audit)]
    MOD --> LOG
    LOG --> TTS2[TTS in the farmer's language]
```

![04-ai-inside](diagrams/04-ai-inside.png)

Rules: the model never produces a number, never calls a tool, never writes to the database; without a key nothing is simulated, the engine answers.

## 3. The sandbox (Azure)

Subscription `AZ-EUR-PlatinionHackathon-Dev`, resource group `CASA-team-2`. Our account is **Contributor** (can create and update resources) and not Owner (cannot grant roles): that is the one reason push-to-deploy is still manual.

| Resource | Type | What it is | Ours |
|---|---|---|---|
| `farm-final-api` | Container App | the FastAPI backend, image tagged by commit (`832d931`) | yes |
| `farm-final-web` | Container App | the Next.js app, the public URL | yes |
| `farm-advisor-speech-casa2` | Azure AI Speech (France Central) | the voice, TTS + STT | yes |
| `growmate-github` | Managed identity | what GitHub signs in as for CD; trusted, waiting for 3 roles | yes |
| `growmateacr2026` | Container Registry | our images (`farm-final-api:<commit>`, `farm-final-web:<commit>`) | shared |
| `growmate-env`, `growmate-logs` | Container Apps environment, Log Analytics | runtime and logs | shared |
| `frontend` | Container App | the team's earlier app (GrowMate) | team |
| `stgrowmate…` | Storage account | from the earlier setup | team |

```mermaid
flowchart TB
    subgraph PHONE[Farmer's phone]
        PWA[Sanabils PWA<br/>offline copy, service worker]
    end
    subgraph AZ[Azure sandbox: CASA-team-2]
        subgraph ENV[Container Apps environment growmate-env]
            WEB[farm-final-web<br/>Next.js, image :commit]
            API[farm-final-api<br/>FastAPI + SQLite, image :commit]
        end
        ACR[(growmateacr2026<br/>Container Registry)]
        SPEECH[farm-advisor-speech-casa2<br/>Azure AI Speech]
        LOGS[growmate-logs]
        MI[growmate-github<br/>managed identity]
    end
    subgraph EXT[Public data, no key]
        S2[Sentinel-2 via Earth Search STAC]
        OM[Open-Meteo]
    end
    subgraph GH[GitHub zakeelm6/bcg-hack-agri-advisor]
        CI[CI: tests, contract, types, Darija, build]
        CD[CD: OIDC login, build images, roll out]
    end
    PWA -- HTTPS + X-Device --> WEB
    PWA -- JSON --> API
    API --> SPEECH
    API --> OM
    S2 -. cached NDVI .-> API
    ACR --> WEB
    ACR --> API
    WEB --> LOGS
    API --> LOGS
    CI --> CD
    CD -- OIDC token --> MI
    MI -. needs AcrPush + Container Apps Contributor .-> ACR
    MI -.-> WEB
    MI -.-> API
```

![05-azure-sandbox](diagrams/05-azure-sandbox.png)

### 3.1 From a push to the farmer's screen

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Actions
    participant AZ as Azure
    participant F as Farmer's phone
    Dev->>GH: git push main
    GH->>GH: tests, openapi diff, tsc, Darija check, build
    alt Owner has granted the 3 roles
        GH->>AZ: OIDC login as growmate-github
        GH->>AZ: build + push farm-final-api::sha, farm-final-web::sha
        GH->>AZ: az containerapp update (API, then web)
        GH->>AZ: check both apps run :sha, /api/health
    else today
        Dev->>AZ: scripts/deploy-now.sh (same steps, team account)
    end
    F->>AZ: open the app (hard reload clears the offline copy)
    AZ-->>F: new version
```

![06-push-to-farmer](diagrams/06-push-to-farmer.png)

## 4. Open decisions for the last stretch

1. **Language model on or off for the demo.** On: an Azure OpenAI deployment and key (about 1 h), optionally the Copilot wrapped as a LangGraph graph with the number check as a node (about 3 h). Off: honest, already works, every text comes from the engine.
2. **Pipeline.** An Owner runs `scripts/azure-grant.sh` (30 s), or the deploy job runs on a team laptop as a self-hosted runner.
3. **Demo rehearsal** on a real phone, in noise, with a native Darija speaker; demo script.

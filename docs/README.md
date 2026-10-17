# Documentation

| Read this | To know |
|---|---|
| [ROADMAP-TEAM-FRONTEND.md](ROADMAP-TEAM-FRONTEND.md) | The plan, step by step, to bring the engine, sensors, voice and polish to the team's web app, and the log of what is done |
| [INTEGRATION.md](INTEGRATION.md) | What was connected between the web app and the engine, how to run both, known gaps |
| [API_CONTRACT.md](API_CONTRACT.md) | The API between the web app and the backend, and the rules for changing it (the machine-readable file is `backend/openapi.json`) |
| [SENSORS.md](SENSORS.md) | The sensor node, what each sensor is for, and what is deliberately not measured |
| [VOICE.md](VOICE.md) | How the Copilot talks and listens (Azure server voice, browser voice, talk mode), setup, tests, limits |
| [DARIJA.md](DARIJA.md) | The Darija (Moroccan Arabic) language: what is translated, voice, tests, limits, how to improve it |
| [architecture-diagram.png](architecture-diagram.png) | Inputs, the sandbox with its agents, outputs |

Where the code is: the engine, the sensor and satellite layers and the Copilot are in `backend/app/processing/`; the routes in
`backend/app/api/routers/`; the web app in `frontend/`. The root [README](../README.md) has the pitch and the status of every part.

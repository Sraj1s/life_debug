# Life Debug

**Notice. Adjust. Begin again.**

Life Debug is a mobile-first behavioral reflection prototype. Users create realistic commitments, log what happened, and receive short, evidence-based reflections.

## Current MVP
- Expo / React Native mobile application with Today, Check-in, Reflect, and Routine screens.
- FastAPI with SQLAlchemy persistence, REST endpoints, and input validation.
- Deterministic reflection that never invents behavioral causes.
- Local SQLite database; optional PostgreSQL using DATABASE_URL.
- Automated backend tests.

> **LOCAL DEVELOPMENT ONLY**: This MVP has no authentication or user-level data isolation. Do not deploy the backend publicly or store sensitive journals. Push notifications and AI coaching are not connected yet.

## Start backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Visit http://127.0.0.1:8000/docs to explore the API.

```bash
cd backend
python -m pytest -q
```

## Start mobile app

Install a current Node.js LTS release, then:

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

On iOS Simulator use 127.0.0.1 for the API URL; on Android Emulator use 10.0.2.2. Physical-device testing requires a reachable trusted local-network backend. Do not expose this unauthenticated API publicly.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Health check |
| POST | /commitments | Create a commitment |
| GET | /commitments | List commitments |
| POST | /commitments/{id}/checkins | Record a check-in |
| GET | /checkins | List events |
| GET | /insights | Reflection from recorded events |

## Roadmap

1. Authenticated per-user accounts and authorization, user deletion/export, secure deployment and migrations
2. Actual scheduling and opt-in notifications, including time-zone-aware rescheduling
3. Behavioral experiments, longitudinal analysis, and opt-in AI-generated suggestions
4. Accessibility, end-to-end mobile testing, and store release readiness

Life Debug is a self-reflection tool, not a medical diagnosis or therapy app.
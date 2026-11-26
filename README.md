# Life Debug

**Notice. Adjust. Begin again.**

Life Debug is a mobile-first behavioral reflection prototype. Users create realistic commitments, log what happened, and receive short, evidence-based reflections.

## Current MVP
- Expo / React Native mobile application with Today, Check-in, Reflect, and Routine screens.
- FastAPI with SQLAlchemy persistence, REST endpoints, and input validation.
- Deterministic reflection that never invents behavioral causes.
- Local SQLite database; optional PostgreSQL using DATABASE_URL.
- Automated backend tests.

> **LOCAL DEVELOPMENT ONLY**: The backend now verifies signed bearer tokens and filters records by authenticated owner, and the Expo client now has a Supabase email/password sign-in screen and sends bearer tokens. End-to-end authentication is NOT yet verified and production security is incomplete. Do not deploy publicly or store sensitive journals. Push notifications and AI coaching are not connected yet.

## Authentication groundwork (not production-ready)

The API now requires signed access tokens for all commitment, check-in and insights endpoints. Configure the identity provider using environment variables (never commit credentials):

- `AUTH_JWKS_URL`: HTTPS address of the provider's public JSON Web Key Set.
- `AUTH_ISSUER`: exact HTTPS issuer claim from provider tokens.
- `AUTH_AUDIENCE`: exact audience claim required by this API.

Tokens must contain `sub`, `exp`, `iat`, `iss` and `aud` claims. Accepted signature algorithms: RS256 and ES256. Without configuration the protected endpoints return HTTP 503 (fail closed). Use a real provider's public JWKS and signed JWT access tokens, not client-chosen user IDs or unsigned mock tokens.

**Migration required:** the commitments table now has a non-null `user_id` column. SQLAlchemy `create_all()` does not update existing tables. Existing local SQLite files need to be backed up and migrated or recreated using throwaway sample data. Do **not** discard or assign existing real records to an arbitrary owner. Production requires versioned migrations, end-to-end login, account deletion/export, provider setup, and security review. The Expo client sends Supabase access tokens. Supabase projects using legacy HS256 JWT signing are incompatible with the current backend JWKS-only RS256/ES256 verifier; configure asymmetric signing and matching issuer/audience, or implement an explicitly reviewed secure alternative. A working Supabase project, matching auth environment variables and real-device verification are still required.

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

On iOS Simulator use 127.0.0.1 for the API URL; on Android Emulator use 10.0.2.2. Physical-device testing requires a reachable trusted local-network backend. Do not expose this not-yet-validated API publicly.

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

1. Complete identity provider setup, mobile login, authenticated integration tests, migrations, user deletion/export and secure deployment
2. Actual scheduling and opt-in notifications, including time-zone-aware rescheduling
3. Behavioral experiments, longitudinal analysis, and opt-in AI-generated suggestions
4. Accessibility, end-to-end mobile testing, and store release readiness

Life Debug is a self-reflection tool, not a medical diagnosis or therapy app.
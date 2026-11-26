# Life Debug

**Notice. Adjust. Begin again.**

Life Debug is a mobile-first behavioral reflection prototype. Users create realistic commitments, log what happened, and receive short, evidence-based reflections.

## Current MVP
- Expo / React Native mobile application with Today, Check-in, Reflect, and Routine screens.
- FastAPI with SQLAlchemy persistence, REST endpoints, and input validation.
- Deterministic reflection that never invents behavioral causes.
- Local SQLite database; optional PostgreSQL using DATABASE_URL.
- Automated backend tests.

> **LOCAL DEVELOPMENT ONLY**: The backend now verifies signed bearer tokens and filters records by authenticated owner, and the Expo client now has an email-code sign-in screen and a Google OAuth flow (provider configuration and device verification still pending) and sends bearer tokens. End-to-end authentication is NOT yet verified and production security is incomplete. Do not deploy publicly or store sensitive journals. Push notifications and AI coaching are not connected yet.

## Authentication groundwork (not production-ready)

The API now requires signed access tokens for all commitment, check-in and insights endpoints. Configure the identity provider using environment variables (never commit credentials):

- `AUTH_JWKS_URL`: HTTPS address of the provider's public JSON Web Key Set.
- `AUTH_ISSUER`: exact HTTPS issuer claim from provider tokens.
- `AUTH_AUDIENCE`: exact audience claim required by this API.

Tokens must contain `sub`, `exp`, `iat`, `iss` and `aud` claims. Accepted signature algorithms: RS256 and ES256. Without configuration the protected endpoints return HTTP 503 (fail closed). Use a real provider's public JWKS and signed JWT access tokens, not client-chosen user IDs or unsigned mock tokens.

**Migration required:** the commitments table now has a non-null `user_id` column. SQLAlchemy `create_all()` does not update existing tables. Existing local SQLite files need to be backed up and migrated or recreated using throwaway sample data. Do **not** discard or assign existing real records to an arbitrary owner. Production requires versioned migrations, end-to-end login, account deletion/export, provider setup, and security review. The Expo client sends Supabase access tokens. Supabase projects using legacy HS256 JWT signing are incompatible with the current backend JWKS-only RS256/ES256 verifier; configure asymmetric signing and matching issuer/audience, or implement an explicitly reviewed secure alternative. A working Supabase project, matching auth environment variables and real-device verification are still required.

## Dedicated Supabase project (development only)

Life Debug now uses its own Supabase project: **Life Debug** (`bbrdiakvwocjblbymuyj`), in `us-east-2`. The other Supabase project belongs to another application and must not be modified for Life Debug. The new project's public URL and expected authentication issuer, JWKS endpoint, and audience are in `backend/.env.example` and `mobile/.env.example`.

Creation was confirmed as `ACTIVE_HEALTHY`; the initial Supabase security advisory check had no findings. GitHub Actions successfully fetched the dedicated project's public JWKS and identified one RS256/ES256-compatible signing key. This confirms a compatible public verification key exists, but does not prove a real user login or sign-out works. The backend still rejects legacy HS256 tokens.

The dedicated project's **public publishable key** is already present in `mobile/.env.example`. Copy that file to `mobile/.env` on your development machine; this key is safe to embed in the Expo client. Never add Supabase service-role/secret keys or private JWT signing keys to mobile code or GitHub. Environment files are ignored from source control. `backend/.env` is not loaded automatically: explicitly export its variables before launching FastAPI.

The backend currently stores commitments and check-ins using local SQLite (or PostgreSQL via `DATABASE_URL`); it is **not** connected to Supabase Postgres by default. Supabase is being used as the identity provider. A real user session, sign-out behavior, mobile device access, migrations, and account deletion/export remain unverified. The Supabase public JWKS is now checked in GitHub CI via `backend/scripts/check_jwks.py`; this check passed with one compatible key. Creating a test account, receiving a real signed access token, verifying it against the running backend, and testing the Expo app on a device remain pending.

## Email OTP and Google authentication setup (required for live use)

The Expo screen offers **Sign up** / **Sign in**, sends an email code with `supabase.auth.signInWithOtp()`, verifies it with `verifyOtp({ type: 'email' })`, and offers **Continue with Google**.

1. In the **Life Debug** Supabase project (`bbrdiakvwocjblbymuyj`), under **Authentication > Email Templates**, edit the **Magic Link** template so that the email body includes `{{ .Token }}` (the six-digit code) **instead of requiring** `{{ .ConfirmationURL }}`. Configure the **Confirm signup** template with `{{ .Token }}` as well if sign-up emails use that template. Keep email confirmation enabled. Do not include the link if you intend a code-only experience.
2. Under **Authentication > Providers > Google**, enable Google OAuth with a Google Cloud OAuth client ID and secret, using the project-specific callback URL shown by Supabase. In Google Cloud Console, register that Supabase callback as an authorized redirect URI. Never commit the Google client secret.
3. Under **Authentication > URL Configuration > Redirect URLs**, allow `lifedebug://google-auth`. Expo's `scheme` is already `lifedebug`; after native configuration changes, rebuild the development app if needed. The OAuth flow opens in Expo WebBrowser and returns to the app with a session.
4. Run `cd mobile && npm install && npx expo start`; use a compatible device development build to test OAuth. Test email sign-up, email sign-in, resend, invalid/expired codes, Google sign-in/cancel, saved commitments, and sign-out.
5. The Supabase default email delivery has rate limits; configure an appropriate email provider before inviting real users. Do not turn off confirmation or log OTP codes/tokens.

These repository updates alone **do not** prove the Supabase provider settings are enabled or that emails were delivered. Until end-to-end tests pass, do not advertise either sign-in method as production-ready.

## Start backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
set -a
. ./.env
set +a
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
# The public key and project URL are prefilled. Adjust EXPO_PUBLIC_API_URL for your emulator or device.
npx expo start
```

On iOS Simulator use 127.0.0.1 for the API URL; on Android Emulator use 10.0.2.2. Physical-device testing requires a reachable trusted local-network backend. Do not expose this not-yet-validated API publicly.

## Live authentication smoke test (disposable account)

The project has an automated **local command** for a real Supabase password sign-in and FastAPI API flow; it is deliberately **not** run in public CI because it needs a private disposable account. The script is syntax-checked by GitHub CI.

1. Start the FastAPI backend using the backend instructions above, including `AUTH_ISSUER`, `AUTH_JWKS_URL`, and `AUTH_AUDIENCE` from `backend/.env`.
2. Run `cd mobile && npm install && cp .env.example .env` and ensure `EXPO_PUBLIC_API_URL` addresses that **running** FastAPI instance. A phone cannot reach your laptop using `127.0.0.1`; for on-device testing use a safely reachable development server.
3. The Expo UI now uses passwordless email OTP codes, whereas this separate automated smoke-test script still uses a disposable email/password account. For the script, create a disposable password-based Supabase test user separately, confirm its email, then supply its credentials. Do not disable email confirmation merely to pass a smoke test.
4. Supply credentials **only in your local shell**, never in source files or GitHub:

```bash
cd mobile
export LIFE_DEBUG_TEST_EMAIL='your-disposable-test-address'
read -s LIFE_DEBUG_TEST_PASSWORD
export LIFE_DEBUG_TEST_PASSWORD
npm run test:auth:e2e
unset LIFE_DEBUG_TEST_PASSWORD
```

The test signs into Supabase, checks `getUser()`, sends the actual access token to FastAPI, creates and reads a commitment, records a check-in, verifies insights, and signs out. It **leaves behind a uniquely named test commitment** under the test account. It does not prove cross-user isolation beyond the existing backend tests, server-side token revocation, or an actual Expo UI flow.

For the device UI check, open the app with Expo Go or a simulator, enter your email, enter the six-digit code from the email, sign in, create a commitment, check it in, verify the reflection, sign out, and confirm the sign-in screen returns. A successful local smoke test is not a substitute for this device check.

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
"""End-to-end FastAPI test using real RSA-signed bearer tokens.

Only public-key discovery is stubbed: auth.current_user, JWT verification,
request routing and SQLAlchemy queries run normally. No live Supabase needed.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from app import auth
from app.main import app


def test_signed_request_flow_isolates_two_users(client, monkeypatch):
    # The shared test fixture injects a fake user by default. Remove that
    # override to exercise the real bearer-token dependency.
    app.dependency_overrides.pop(auth.current_user, None)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    issuer = "https://sample-project.supabase.co/auth/v1"
    monkeypatch.setenv("AUTH_JWKS_URL", issuer + "/.well-known/jwks.json")
    monkeypatch.setenv("AUTH_ISSUER", issuer)
    monkeypatch.setenv("AUTH_AUDIENCE", "authenticated")

    class StubJWKClient:
        def __init__(self, url, **kwargs):
            assert url == issuer + "/.well-known/jwks.json"

        def get_signing_key_from_jwt(self, signed_jwt):
            return SimpleNamespace(key=public_key)

    monkeypatch.setattr(auth, "PyJWKClient", StubJWKClient)

    def headers(subject):
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {"sub": subject, "iss": issuer, "aud": "authenticated",
             "iat": now, "exp": now + timedelta(minutes=15)},
            private_key, algorithm="RS256",
        )
        return {"Authorization": "Bearer " + token}

    user_a = headers("user-a")
    user_b = headers("user-b")

    assert client.get("/commitments").status_code == 401
    created = client.post(
        "/commitments",
        json={"title": "Study Python", "scheduled_time": "07:00"},
        headers=user_a,
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    assert client.get("/commitments", headers=user_a).json()[0]["id"] == item_id
    assert client.get("/commitments", headers=user_b).json() == []
    assert client.post(
        f"/commitments/{item_id}/checkins",
        json={"status": "completed"},
        headers=user_b,
    ).status_code == 404

    logged = client.post(
        f"/commitments/{item_id}/checkins",
        json={"status": "completed"},
        headers=user_a,
    )
    assert logged.status_code == 201, logged.text
    assert client.get("/insights", headers=user_a).json()["completed"] == 1
    assert client.get("/insights", headers=user_b).json()["checkins"] == 0
    assert client.get("/checkins", headers=user_b).json() == []


def test_invalid_bearer_token_cannot_access_records(client, monkeypatch):
    app.dependency_overrides.pop(auth.current_user, None)
    monkeypatch.setenv("AUTH_JWKS_URL", "https://sample-project.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("AUTH_ISSUER", "https://sample-project.supabase.co/auth/v1")
    monkeypatch.setenv("AUTH_AUDIENCE", "authenticated")

    # Malformed tokens must never expose private records, even if the
    # JWKS lookup fails. A provider outage should also fail closed.
    assert client.get(
        "/commitments",
        headers={"Authorization": "Bearer definitely-not-a-jwt"},
    ).status_code in (401, 503)

"""Check real JWT signature verification without network access or live credentials."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth

ISSUER = "https://auth.example.test/auth/v1"
AUDIENCE = "authenticated"


@pytest.fixture
def signing_setup(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    monkeypatch.setenv("AUTH_JWKS_URL", "https://auth.example.test/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("AUTH_ISSUER", ISSUER)
    monkeypatch.setenv("AUTH_AUDIENCE", AUDIENCE)

    class LocalJWKS:
        def __init__(self, url, **kwargs):
            assert url.startswith("https://")

        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=public_key)

    # Only JWKS retrieval is mocked: RSA signature verification still runs.
    monkeypatch.setattr(auth, "PyJWKClient", LocalJWKS)

    def token(**overrides):
        now = datetime.now(timezone.utc)
        claims = {
            "sub": "user-123",
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        }
        claims.update(overrides)
        return jwt.encode(claims, private_key, algorithm="RS256")

    return token


def verify(encoded):
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=encoded)
    return auth.current_user(credentials)


def test_valid_signed_token_identifies_subject(signing_setup):
    assert verify(signing_setup()) == "user-123"


@pytest.mark.parametrize("claims", [
    {"aud": "some-other-api"},
    {"iss": "https://wrong-issuer.example.test"},
    {"exp": datetime(2000, 1, 1, tzinfo=timezone.utc)},
    {"sub": ""},
    {"sub": None},
])
def test_invalid_claims_are_rejected(signing_setup, claims):
    with pytest.raises(HTTPException) as exc:
        verify(signing_setup(**claims))
    assert exc.value.status_code == 401


def test_missing_required_subject_rejected(signing_setup):
    with pytest.raises(HTTPException) as exc:
        verify(signing_setup(sub=None))
    assert exc.value.status_code == 401


def test_tampered_signature_rejected(signing_setup):
    parts = signing_setup().split(".")
    signature = parts[2]
    parts[2] = ("A" if signature[0] != "A" else "B") + signature[1:]
    with pytest.raises(HTTPException) as exc:
        verify(".".join(parts))
    assert exc.value.status_code == 401


def test_missing_bearer_token_rejected(signing_setup):
    with pytest.raises(HTTPException) as exc:
        auth.current_user(None)
    assert exc.value.status_code == 401


def test_unconfigured_provider_fails_closed(signing_setup, monkeypatch):
    monkeypatch.delenv("AUTH_AUDIENCE")
    with pytest.raises(HTTPException) as exc:
        verify(signing_setup())
    assert exc.value.status_code == 503

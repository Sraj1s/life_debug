"""Verify signed access tokens from an external identity provider.

Set AUTH_JWKS_URL, AUTH_ISSUER and AUTH_AUDIENCE. No token is trusted
without signature, issuer, audience and expiration verification.
"""
import os

import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWTError

bearer = HTTPBearer(auto_error=False)

def current_user(credentials: HTTPAuthorizationCredentials | None = Security(bearer)) -> str:
    jwks_url = os.getenv("AUTH_JWKS_URL", "")
    issuer = os.getenv("AUTH_ISSUER", "")
    audience = os.getenv("AUTH_AUDIENCE", "")
    if not all((jwks_url.startswith("https://"), issuer.startswith("https://"), audience)):
        raise HTTPException(status_code=503, detail="Authentication provider not configured")
    if credentials is None:
        raise HTTPException(status_code=401, detail="Bearer token required", headers={"WWW-Authenticate": "Bearer"})
    try:
        # PyJWKClient caches the signing key set; algorithms are fixed,
        # never selected from the token's untrusted header.
        key = PyJWKClient(jwks_url, cache_jwk_set=True).get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            key.key,
            algorithms=["RS256", "ES256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
            leeway=30,
        )
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.strip() or len(subject) > 255:
            raise ValueError("Missing valid subject")
        return subject
    except (PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid access token", headers={"WWW-Authenticate": "Bearer"})

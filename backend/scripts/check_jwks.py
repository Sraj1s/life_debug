"""Verify public Supabase JWKS exposes a key our FastAPI verifier accepts.

This only reads public verification keys. It cannot prove real login works.
"""
import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    url = os.environ.get("AUTH_JWKS_URL", "")
    if not url.startswith("https://"):
        print("AUTH_JWKS_URL must be an HTTPS URL", file=sys.stderr)
        return 1
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            jwks = json.load(response)
    except (OSError, ValueError, urllib.error.URLError) as exc:
        print(f"Cannot fetch Supabase public JWKS: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    keys = jwks.get("keys", [])
    compatible = [
        k for k in keys
        if isinstance(k, dict)
        and k.get("use", "sig") == "sig"
        and ((k.get("kty") == "RSA" and k.get("alg", "RS256") == "RS256")
             or (k.get("kty") == "EC" and k.get("crv") == "P-256"
                 and k.get("alg", "ES256") == "ES256"))
    ]
    if not compatible:
        print("Supabase JWKS has no public RS256/ES256 signing key. "
              "Configure an asymmetric signing key in Auth > Signing Keys. "
              "HS256 keys cannot be verified with the backend's JWKS-only verifier.",
              file=sys.stderr)
        return 1
    print(f"Supabase JWKS reachable; {len(compatible)} compatible public signing key(s) found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

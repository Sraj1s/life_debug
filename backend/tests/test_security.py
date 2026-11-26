"""Regression tests: records cannot cross user boundaries."""
from app.auth import current_user
from app.main import app


def test_users_only_see_their_own_records(client):
    a = client.post("/commitments", json={"title": "Study", "scheduled_time": "07:00"})
    assert a.status_code == 201
    aid = a.json()["id"]
    assert client.post(f"/commitments/{aid}/checkins", json={"status": "completed"}).status_code == 201

    app.dependency_overrides[current_user] = lambda: "test-user-b"
    assert client.get("/commitments").json() == []
    assert client.get("/checkins").json() == []
    assert client.get("/insights").json()["checkins"] == 0
    assert client.post(f"/commitments/{aid}/checkins", json={"status": "missed"}).status_code == 404

    b = client.post("/commitments", json={"title": "Gym", "scheduled_time": "18:00"})
    assert b.status_code == 201
    assert len(client.get("/commitments").json()) == 1

    app.dependency_overrides[current_user] = lambda: "test-user-a"
    assert [item["id"] for item in client.get("/commitments").json()] == [aid]
    assert client.get("/insights").json()["checkins"] == 1


def test_unconfigured_auth_fails_closed(client, monkeypatch):
    app.dependency_overrides.pop(current_user, None)
    for name in ("AUTH_JWKS_URL", "AUTH_ISSUER", "AUTH_AUDIENCE"):
        monkeypatch.delenv(name, raising=False)
    assert client.get("/commitments").status_code == 503
    assert client.get("/health").status_code == 200

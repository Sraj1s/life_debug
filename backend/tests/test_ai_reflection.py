"""AI reflections are opt-in, scoped to the logged-in user, and safe without a key."""
from unittest.mock import patch
from app.ai_reflection import generate_reflection

def test_ai_fallback_without_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    item = client.post("/commitments", json={"title": "Walk", "scheduled_time": "08:00"}).json()
    client.post(f"/commitments/{item['id']}/checkins", json={"status": "missed", "reason": "tired", "note": "private note"})
    response = client.post("/insights/ai")
    assert response.status_code == 200
    assert response.json()["source"] == "rules"
    assert response.json()["reflection"]

def test_ai_uses_only_aggregated_anonymous_data(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-for-test")
    item = client.post("/commitments", json={"title": "Private commitment title", "scheduled_time": "08:00"}).json()
    client.post(f"/commitments/{item['id']}/checkins", json={"status": "missed", "reason": "tired", "note": "do not send me"})
    class FakeResponse:
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def read(self, *args): return b'{"output":[{"content":[{"type":"output_text","text":"Try one smaller step tomorrow."}]}]}'
    def fake_urlopen(request, timeout):
        assert timeout == 8
        body = request.data.decode("utf-8")
        assert "do not send me" not in body
        assert "Private commitment title" not in body
        assert "test-user-a" not in body
        assert '"tired"' in body
        return FakeResponse()
    with patch("app.ai_reflection.urlopen", side_effect=fake_urlopen):
        response = client.post("/insights/ai")
    assert response.status_code == 200
    assert response.json() == {"reflection": "Try one smaller step tomorrow.", "source": "ai"}

def test_ai_provider_errors_fall_back(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-for-test")
    item = client.post("/commitments", json={"title": "Study", "scheduled_time": "08:00"}).json()
    client.post(f"/commitments/{item['id']}/checkins", json={"status": "completed"})
    with patch("app.ai_reflection.urlopen", side_effect=TimeoutError("AI timed out")):
        response = client.post("/insights/ai")
    assert response.status_code == 200
    assert response.json()["source"] == "rules"

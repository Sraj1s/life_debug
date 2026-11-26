def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}

def test_empty_insights(client):
    result = client.get("/insights").json()
    assert result["checkins"] == 0
    assert result["completion_rate"] is None

def test_commitment_checkins_and_reflection(client):
    assert client.post("/commitments", json={"title": " ", "scheduled_time": "25:00"}).status_code == 422
    response = client.post("/commitments", json={"title": " Study Python ", "scheduled_time": "07:00"})
    assert response.status_code == 201
    item = response.json()
    assert item["title"] == "Study Python"
    assert len(client.get("/commitments").json()) == 1
    for status, reason in [("completed", None), ("missed", "outside"), ("completed", None)]:
        response = client.post(f"/commitments/{item['id']}/checkins", json={"status": status, "reason": reason})
        assert response.status_code == 201
    result = client.get("/insights").json()
    assert result["checkins"] == 3
    assert result["completed"] == 2
    assert result["completion_rate"] == 66.7
    assert result["top_obstacle"] == "outside"

def test_unknown_commitment(client):
    assert client.post("/commitments/999/checkins", json={"status": "completed"}).status_code == 404

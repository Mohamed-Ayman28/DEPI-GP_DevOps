import datetime
import pytest
from fastapi.testclient import TestClient
from main import app
from auth import create_token, decode_token, hash_password, verify_password
from models import SignupModel
from routers.events import serialize_event
from routers.tasks import serialize_task

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "EventPlanner API running"}


def test_password_hashing():
    raw = "supersecret123"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_token_lifecycle():
    data = {"id": 42, "email": "test@example.com", "role": "customer"}
    token = create_token(data)
    decoded = decode_token(token)
    assert decoded["id"] == 42
    assert decoded["email"] == "test@example.com"
    assert decoded["role"] == "customer"


def test_serialize_event():
    raw_event = {
        "id": 1,
        "title": "Meeting",
        "date": datetime.date(2026, 11, 8),
        "time": datetime.timedelta(hours=14, minutes=30),
        "created_at": datetime.datetime(2026, 11, 8, 12, 0, 0)
    }
    serialized = serialize_event(raw_event)
    assert serialized["date"] == "2026-11-08"
    assert serialized["time"] == "14:30:00"
    assert "2026-11-08T12:00:00" in serialized["created_at"]


def test_serialize_task():
    raw_task = {
        "id": 1,
        "title": "Task 1",
        "due_date": datetime.date(2026, 12, 1),
        "created_at": datetime.datetime(2026, 11, 8, 10, 0, 0)
    }
    serialized = serialize_task(raw_task)
    assert serialized["due_date"] == "2026-12-01"
    assert "2026-11-08T10:00:00" in serialized["created_at"]


def test_task_route_precedence():
    # Ensure /tasks/assigned and /tasks/search match their respective routes rather than /{task_id}
    # Without token, they should return 401 Unauthorized, NOT 422 Unprocessable Entity (which happens when /{task_id} intercepts)
    res_assigned = client.get("/tasks/assigned")
    assert res_assigned.status_code == 401, f"Expected 401, got {res_assigned.status_code}: {res_assigned.text}"

    res_search = client.get("/tasks/search")
    assert res_search.status_code == 401, f"Expected 401, got {res_search.status_code}: {res_search.text}"


def test_signup_model_defaults():
    data = {"name": "Vendor User", "email": "vendor@test.com", "password": "pass", "phone_number": "123"}
    model = SignupModel(**data)
    assert model.role == "customer"

    model_vendor = SignupModel(**data, role="vendor")
    assert model_vendor.role == "vendor"



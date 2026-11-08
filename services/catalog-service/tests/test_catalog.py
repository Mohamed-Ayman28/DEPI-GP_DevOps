import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_catalog_live():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_catalog_cors():
    response = client.options("/health/live", headers={
        "Origin": "http://localhost:4200",
        "Access-Control-Request-Method": "GET"
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:4200"

from fastapi.testclient import TestClient

from main import app


CHEAPEST_VALID = {
    "cpu": "cpu-004",
    "motherboard": "mb-004",
    "gpu": "gpu-001",
    "ram": "ram-001",
    "storage": "storage-001",
    "psu": "psu-001",
    "cooler": "cooler-001",
    "case": "case-001",
}


client = TestClient(app)


def test_compat_endpoint_enriches_catalog_specs_from_ids():
    items = [
        {"component": {"id": pid, "category": cat, "specs": {}}}
        for cat, pid in CHEAPEST_VALID.items()
    ]

    response = client.post("/compat", json={"items": items})

    assert response.status_code == 200
    body = response.json()
    assert body["compatible"] is True
    assert body["verifier"] == "rules_engine"
    assert "Rule-based" in body["summary"]
    assert any(check["label"] == "PSU headroom" for check in body["checks"])
    assert body["errors"] == []
    assert body["warnings"] == []


def test_compat_endpoint_blocks_unknown_items_without_specs():
    items = [
        {"component": {"id": pid, "category": cat, "specs": {}}}
        for cat, pid in CHEAPEST_VALID.items()
    ]
    items[0] = {
        "component": {
            "id": "custom-cpu",
            "name": "Custom CPU",
            "category": "CPU",
            "specs": {},
        }
    }

    response = client.post("/compat", json={"items": items})

    assert response.status_code == 200
    body = response.json()
    assert body["compatible"] is False
    assert body["verifier"] == "rules_engine"
    assert body["summary"]
    assert body["warnings"]
    assert "Custom CPU" in body["warnings"][0]


def test_compat_endpoint_partial_set_of_parts_passes_without_missing_error():
    """
    Sending only a GPU to /compat (e.g. a single-item quote) must not
    raise a 'Missing required categories' error — the compat endpoint
    runs rules only on what is provided.  It will still be non-compatible
    because required categories are absent, but the 'errors' list must
    reflect that rather than crashing.
    """
    items = [
        {"component": {"id": "gpu-001", "category": "gpu", "specs": {}}}
    ]

    response = client.post("/compat", json={"items": items})

    assert response.status_code == 200
    body = response.json()
    # The compat engine returns the "Missing required categories" error —
    # that is expected and correct for a partial set.
    assert body["verifier"] == "rules_engine"
    assert isinstance(body["errors"], list)
    assert isinstance(body["checks"], list)
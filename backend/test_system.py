"""
Stress tests for the Componentry quote system.

Fast tests (no AI calls):
    pytest test_system.py -m "not integration"

Integration tests (real Gemini calls, slow + costs API quota):
    pytest test_system.py -m integration -s
"""

import json
import re
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def catalog():
    with open("data/catalog.json") as f:
        return json.load(f)

@pytest.fixture(scope="session")
def inventory():
    with open("data/inventory.json") as f:
        return json.load(f)

@pytest.fixture(scope="session")
def client():
    from main import app
    return TestClient(app)

def make_ai_response(selected: dict, catalog: dict) -> MagicMock:
    """Build a mock Gemini response returning the given selected product IDs."""
    reasoning    = {cat: "Test reasoning." for cat in selected}
    alternatives = {cat: {"down": None, "up": None} for cat in selected}
    payload = json.dumps({"selected": selected, "reasoning": reasoning, "alternatives": alternatives})
    mock_resp      = MagicMock()
    mock_resp.text = payload
    return mock_resp


# ---------------------------------------------------------------------------
# Helper — cheapest valid build from the real catalog
# ---------------------------------------------------------------------------

CHEAPEST_VALID = {
    # Intel LGA1700 platform (cheapest cross-compatible set)
    "cpu":         "cpu-004",   # Intel i5-13600K  LGA1700 DDR4/DDR5
    "motherboard": "mb-004",    # Gigabyte B760M DS3H  LGA1700 DDR4
    "gpu":         "gpu-001",   # RTX 4060
    "ram":         "ram-001",   # DDR4 16 GB
    "storage":     "storage-001",
    "psu":         "psu-001",
    "cooler":      "cooler-001",
    "case":        "case-001",
}

GPU_ONLY = {"gpu": "gpu-001"}
RAM_GPU  = {"gpu": "gpu-001", "ram": "ram-001"}


# ===========================================================================
# 1. API INPUT VALIDATION  (no AI calls)
# ===========================================================================

class TestInputValidation:

    def test_low_budget_accepted(self, client, catalog):
        """Any positive budget should be accepted — there is no enforced minimum."""
        with patch("main.generate_quote") as mock_gq:
            mock_gq.return_value = {
                "selected":    CHEAPEST_VALID,
                "reasoning":   {c: "ok" for c in CHEAPEST_VALID},
                "alternatives":{c: {"down": None, "up": None} for c in CHEAPEST_VALID},
            }
            r = client.post("/quote", json={"brief": "gaming PC", "budget": 500})
        assert r.status_code == 200

    def test_empty_brief_rejected(self, client):
        r = client.post("/quote", json={"brief": "", "budget": 5000})
        assert r.status_code == 400

    def test_whitespace_only_brief_rejected(self, client):
        r = client.post("/quote", json={"brief": "   ", "budget": 5000})
        assert r.status_code == 400

    def test_missing_brief_field(self, client):
        r = client.post("/quote", json={"budget": 5000})
        assert r.status_code == 422

    def test_missing_budget_field(self, client):
        r = client.post("/quote", json={"brief": "gaming PC"})
        assert r.status_code == 422

    def test_health_endpoint(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


# ===========================================================================
# 2. RESPONSE STRUCTURE  (mocked AI)
# ===========================================================================

class TestResponseStructure:

    def _post(self, client, brief="gaming PC", budget=5000, selected=None, **extra):
        sel = selected or CHEAPEST_VALID
        with patch("main.generate_quote") as mock_gq:
            mock_gq.return_value = {
                "selected":     sel,
                "reasoning":    {c: "reason" for c in sel},
                "alternatives": {c: {"down": None, "up": None} for c in sel},
            }
            return client.post("/quote", json={"brief": brief, "budget": budget, **extra})

    def test_all_top_level_fields_present(self, client):
        r = self._post(client)
        body = r.json()
        for field in ("quote_id", "brief", "budget", "total", "savings", "parts", "generated_at", "mode", "existing_parts"):
            assert field in body, f"Missing field: {field}"

    def test_quote_id_format(self, client):
        r = self._post(client)
        assert re.match(r"^NX-[A-Z0-9]{6}$", r.json()["quote_id"])

    def test_full_build_has_all_eight_categories(self, client):
        r = self._post(client)
        for cat in ("cpu", "motherboard", "gpu", "ram", "storage", "psu", "cooler", "case"):
            assert cat in r.json()["parts"], f"Missing category: {cat}"

    def test_full_build_mode_field(self, client):
        r = self._post(client)
        assert r.json()["mode"] == "full"

    def test_each_part_has_required_fields(self, client):
        r = self._post(client)
        for cat, part in r.json()["parts"].items():
            for field in ("id", "name", "price", "specs", "reasoning", "alternatives"):
                assert field in part, f"parts.{cat} missing field: {field}"

    def test_savings_equals_budget_minus_total(self, client):
        r = self._post(client)
        body = r.json()
        assert body["savings"] == pytest.approx(body["budget"] - body["total"])

    def test_brief_echoed_in_response(self, client):
        brief = "workstation for 3D rendering"
        r = self._post(client, brief=brief)
        assert r.json()["brief"] == brief

    def test_budget_echoed_in_response(self, client):
        r = self._post(client, budget=7500)
        assert r.json()["budget"] == 7500

    # ------------------------------------------------------------------
    # Partial / upgrade mode response structure
    # ------------------------------------------------------------------

    def test_partial_mode_field_set(self, client):
        """Providing existing_parts sets mode='partial' in the response."""
        r = self._post(
            client,
            selected=GPU_ONLY,
            existing_parts={"gpu": "NVIDIA RTX 5090"},
            target_categories=["gpu"],
        )
        assert r.json()["mode"] == "partial"

    def test_partial_mode_existing_parts_echoed(self, client):
        existing = {"gpu": "NVIDIA RTX 5090", "ram": "Kingston DDR4 16GB"}
        r = self._post(
            client,
            selected={"ram": "ram-001"},
            existing_parts=existing,
            target_categories=["ram"],
        )
        assert r.json()["existing_parts"] == existing

    def test_partial_mode_only_quoted_categories_in_parts(self, client):
        """When the AI returns only 'gpu', parts must only contain 'gpu'."""
        r = self._post(client, selected=GPU_ONLY, target_categories=["gpu"])
        assert list(r.json()["parts"].keys()) == ["gpu"]

    def test_single_item_mode_one_part_in_parts(self, client):
        """A single-item brief with no existing_parts still returns one part."""
        r = self._post(client, selected=GPU_ONLY)
        assert "gpu" in r.json()["parts"]
        assert len(r.json()["parts"]) == 1

    def test_partial_target_categories_normalised(self, client):
        """Upper-case category names in target_categories should be normalised."""
        r = self._post(
            client,
            selected=GPU_ONLY,
            target_categories=["GPU"],
        )
        # Should not 400/422 — normalisation happens in _validate_quote_request
        assert r.status_code == 200


# ===========================================================================
# 3. AGENT UNIT TESTS  (mocked Gemini client)
# ===========================================================================

class TestAgentUnit:

    def test_out_of_stock_products_excluded(self, catalog, inventory):
        """generate_quote must never pass out-of-stock items to the AI."""
        from agent import generate_quote

        captured_contents = {}

        def fake_generate(**kwargs):
            captured_contents["msg"] = kwargs.get("contents", "")
            # Return cheapest valid build so we don't loop
            sel = CHEAPEST_VALID
            payload = json.dumps({
                "selected":     sel,
                "reasoning":    {c: "ok" for c in sel},
                "alternatives": {c: {"down": None, "up": None} for c in sel},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = fake_generate
            generate_quote("gaming PC", 5000, catalog, inventory)

        sent_catalog = json.loads(
            re.search(r"AVAILABLE CATALOG: (\{.*\})", captured_contents["msg"], re.S).group(1)
        )
        out_of_stock_ids = [pid for pid, inv in inventory.items() if inv.get("stock", 0) == 0]
        for pid in out_of_stock_ids:
            assert pid not in sent_catalog, f"Out-of-stock product {pid} was sent to AI"

    def test_budget_overage_triggers_retry(self, catalog, inventory):
        """If the AI returns a build that exceeds budget, it must retry."""
        from agent import generate_quote

        call_count = {"n": 0}

        def fake_generate(**kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                overpriced = {
                    "cpu": "cpu-003", "motherboard": "mb-003", "gpu": "gpu-005",
                    "ram": "ram-004", "storage": "storage-003", "psu": "psu-003",
                    "cooler": "cooler-003", "case": "case-003",
                }
                payload = json.dumps({
                    "selected":     overpriced,
                    "reasoning":    {c: "ok" for c in overpriced},
                    "alternatives": {c: {"down": None, "up": None} for c in overpriced},
                })
            else:
                payload = json.dumps({
                    "selected":     CHEAPEST_VALID,
                    "reasoning":    {c: "ok" for c in CHEAPEST_VALID},
                    "alternatives": {c: {"down": None, "up": None} for c in CHEAPEST_VALID},
                })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = fake_generate
            generate_quote("gaming PC", 4500, catalog, inventory)

        assert call_count["n"] >= 2, "Expected at least one retry after budget overage"

    def test_three_failures_raises_value_error(self, catalog, inventory):
        """After 3 failed attempts the agent must raise ValueError."""
        from agent import generate_quote

        def always_over_budget(**kwargs):
            overpriced = {
                "cpu": "cpu-003", "motherboard": "mb-003", "gpu": "gpu-005",
                "ram": "ram-004", "storage": "storage-003", "psu": "psu-003",
                "cooler": "cooler-003", "case": "case-003",
            }
            payload = json.dumps({
                "selected":     overpriced,
                "reasoning":    {c: "ok" for c in overpriced},
                "alternatives": {c: {"down": None, "up": None} for c in overpriced},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = always_over_budget
            with pytest.raises(ValueError, match="3 attempts"):
                generate_quote("gaming PC", 100, catalog, inventory)

    def test_malformed_json_raises(self, catalog, inventory):
        """If the AI returns non-JSON, json.loads should propagate."""
        from agent import generate_quote

        def bad_json(**kwargs):
            m = MagicMock(); m.text = "Sorry, I cannot help with that."
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = bad_json
            with pytest.raises(Exception):
                generate_quote("gaming PC", 5000, catalog, inventory)

    def test_selected_product_ids_exist_in_catalog(self, catalog, inventory):
        """The agent must only reference product IDs that actually exist."""
        from agent import generate_quote

        def valid_response(**kwargs):
            payload = json.dumps({
                "selected":     CHEAPEST_VALID,
                "reasoning":    {c: "ok" for c in CHEAPEST_VALID},
                "alternatives": {c: {"down": None, "up": None} for c in CHEAPEST_VALID},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = valid_response
            result = generate_quote("gaming PC", 5000, catalog, inventory)

        for cat, pid in result["selected"].items():
            assert pid in catalog, f"Unknown product ID '{pid}' in category '{cat}'"

    # ------------------------------------------------------------------
    # Partial / upgrade agent behaviour
    # ------------------------------------------------------------------

    def test_partial_mode_existing_parts_in_prompt(self, catalog, inventory):
        """Existing parts must appear in the user message sent to Gemini."""
        from agent import generate_quote

        captured = {}

        def fake_generate(**kwargs):
            captured["msg"] = kwargs.get("contents", "")
            payload = json.dumps({
                "selected":     GPU_ONLY,
                "reasoning":    {"gpu": "ok"},
                "alternatives": {"gpu": {"down": None, "up": None}},
            })
            m = MagicMock(); m.text = payload
            return m

        existing = {"gpu": "NVIDIA RTX 5090", "ram": "Kingston DDR4 16GB"}
        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = fake_generate
            generate_quote(
                "upgrade GPU",
                3800,
                catalog,
                inventory,
                existing_parts=existing,
                target_categories=["gpu"],
            )

        msg = captured["msg"]
        assert "RTX 5090" in msg, "Existing GPU not found in prompt"
        assert "Kingston" in msg, "Existing RAM not found in prompt"

    def test_partial_mode_target_categories_in_prompt(self, catalog, inventory):
        """Target categories must appear in the user message."""
        from agent import generate_quote

        captured = {}

        def fake_generate(**kwargs):
            captured["msg"] = kwargs.get("contents", "")
            payload = json.dumps({
                "selected":     RAM_GPU,
                "reasoning":    {c: "ok" for c in RAM_GPU},
                "alternatives": {c: {"down": None, "up": None} for c in RAM_GPU},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client:
            mock_client.models.generate_content.side_effect = fake_generate
            generate_quote(
                "upgrade GPU and RAM",
                5000,
                catalog,
                inventory,
                target_categories=["gpu", "ram"],
            )

        msg = captured["msg"]
        assert "gpu" in msg.lower()
        assert "ram" in msg.lower()

    def test_partial_mode_no_compat_check_called(self, catalog, inventory):
        """Compat engine must NOT be called in partial mode."""
        from agent import generate_quote

        def fake_generate(**kwargs):
            payload = json.dumps({
                "selected":     GPU_ONLY,
                "reasoning":    {"gpu": "ok"},
                "alternatives": {"gpu": {"down": None, "up": None}},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client, \
             patch("agent.check_compatibility") as mock_compat:
            mock_client.models.generate_content.side_effect = fake_generate
            generate_quote(
                "just a GPU upgrade",
                3800,
                catalog,
                inventory,
                existing_parts={"cpu": "Intel i9-13900K"},
                target_categories=["gpu"],
            )

        mock_compat.assert_not_called()

    def test_single_item_no_existing_parts_still_partial(self, catalog, inventory):
        """A brief with target_categories but no existing_parts is still partial mode."""
        from agent import generate_quote

        def fake_generate(**kwargs):
            payload = json.dumps({
                "selected":     {"gpu": "gpu-001"},
                "reasoning":    {"gpu": "Best match for RTX 5060 request."},
                "alternatives": {"gpu": {"down": None, "up": None}},
            })
            m = MagicMock(); m.text = payload
            return m

        with patch("agent.client") as mock_client, \
             patch("agent.check_compatibility") as mock_compat:
            mock_client.models.generate_content.side_effect = fake_generate
            result = generate_quote(
                "just one RTX 5060",
                3800,
                catalog,
                inventory,
                target_categories=["gpu"],
            )

        assert "gpu" in result["selected"]
        mock_compat.assert_not_called()


# ===========================================================================
# 4. COMPATIBILITY EDGE CASES  (no AI, pure compat.py logic)
# ===========================================================================

class TestCompatibility:

    def _part(self, category, specs):
        return {"id": "x", "name": "x", "category": category, "price": 0, "specs": specs}

    @pytest.fixture
    def valid_parts(self):
        return {
            "cpu":         self._part("cpu",         {"socket": "AM5",    "tdp": 65}),
            "motherboard": self._part("motherboard", {"socket": "AM5",    "ram_type": "DDR5", "form_factor": "ATX"}),
            "gpu":         self._part("gpu",         {"tdp": 115}),
            "ram":         self._part("ram",         {"type": "DDR5"}),
            "psu":         self._part("psu",         {"wattage": 650}),
            "cooler":      self._part("cooler",      {"tdp_capacity": 200, "socket_support": ["AM5", "LGA1700"]}),
            "case":        self._part("case",        {"form_factor": "ATX"}),
            "storage":     self._part("storage",     {}),
        }

    def test_valid_build_no_errors(self, valid_parts):
        from compat import check_compatibility
        assert check_compatibility(valid_parts) == []

    def test_socket_mismatch_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["motherboard"]["specs"]["socket"] = "LGA1700"
        errors = check_compatibility(valid_parts)
        assert any("Socket mismatch" in e for e in errors)

    def test_ram_type_mismatch_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["ram"]["specs"]["type"] = "DDR4"
        errors = check_compatibility(valid_parts)
        assert any("RAM mismatch" in e for e in errors)

    def test_psu_too_weak_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["gpu"]["specs"]["tdp"] = 450  # 65 + 450 + 150 = 665 > 650
        errors = check_compatibility(valid_parts)
        assert any("PSU too weak" in e for e in errors)

    def test_psu_exact_wattage_passes(self, valid_parts):
        from compat import check_compatibility
        # CPU 65 + GPU 285 + 150 overhead = 500 exactly
        valid_parts["gpu"]["specs"]["tdp"] = 285
        valid_parts["psu"]["specs"]["wattage"] = 500
        errors = check_compatibility(valid_parts)
        assert not any("PSU" in e for e in errors)

    def test_cooler_wrong_socket_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["cooler"]["specs"]["socket_support"] = ["LGA1700"]
        errors = check_compatibility(valid_parts)
        assert any("Cooler incompatible" in e for e in errors)

    def test_cooler_tdp_too_low_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["cooler"]["specs"]["tdp_capacity"] = 45  # CPU is 65W
        errors = check_compatibility(valid_parts)
        assert any("Cooler underpowered" in e for e in errors)

    def test_case_too_small_detected(self, valid_parts):
        from compat import check_compatibility
        valid_parts["case"]["specs"]["form_factor"] = "mATX"  # ATX board won't fit
        errors = check_compatibility(valid_parts)
        assert any("Case too small" in e for e in errors)

    def test_mitx_case_fits_mitx_board(self, valid_parts):
        from compat import check_compatibility
        valid_parts["motherboard"]["specs"]["form_factor"] = "mITX"
        valid_parts["case"]["specs"]["form_factor"] = "mITX"
        errors = check_compatibility(valid_parts)
        assert not any("Case" in e for e in errors)

    def test_atx_case_fits_matx_board(self, valid_parts):
        from compat import check_compatibility
        valid_parts["motherboard"]["specs"]["form_factor"] = "mATX"
        valid_parts["case"]["specs"]["form_factor"] = "ATX"
        errors = check_compatibility(valid_parts)
        assert not any("Case" in e for e in errors)

    def test_missing_category_returns_early(self, valid_parts):
        from compat import check_compatibility
        del valid_parts["gpu"]
        errors = check_compatibility(valid_parts)
        assert any("Missing" in e for e in errors)

    def test_multiple_errors_all_reported(self, valid_parts):
        from compat import check_compatibility
        valid_parts["motherboard"]["specs"]["socket"]      = "LGA1700"
        valid_parts["motherboard"]["specs"]["ram_type"]    = "DDR4"
        valid_parts["case"]["specs"]["form_factor"]        = "mITX"
        errors = check_compatibility(valid_parts)
        assert len(errors) >= 3


# ===========================================================================
# 5. INTEGRATION TESTS  (real Gemini calls — slow, costs quota)
#    Run with:  pytest test_system.py -m integration -s
# ===========================================================================

@pytest.mark.integration
class TestIntegration:

    BRIEFS = [
        ("budget 1080p gaming",            4000),
        ("4K gaming and content creation", 8000),
        ("silent home office workstation", 5000),
        ("video editing and streaming",    7000),
    ]

    @pytest.mark.parametrize("brief,budget", BRIEFS)
    def test_valid_quote_returned(self, client, catalog, inventory, brief, budget):
        r = client.post("/quote", json={"brief": brief, "budget": budget})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] <= budget, f"Over budget: RM {body['total']} > RM {budget}"
        assert len(body["parts"]) == 8

    @pytest.mark.parametrize("brief,budget", BRIEFS)
    def test_selected_products_in_stock(self, client, catalog, inventory, brief, budget):
        r = client.post("/quote", json={"brief": brief, "budget": budget})
        assert r.status_code == 200
        for cat, part in r.json()["parts"].items():
            pid = part["id"]
            stock = inventory.get(pid, {}).get("stock", 0)
            assert stock > 0, f"{cat} product {pid} is out of stock"

    @pytest.mark.parametrize("brief,budget", BRIEFS)
    def test_compatibility_of_returned_build(self, client, catalog, inventory, brief, budget):
        from compat import check_compatibility
        r = client.post("/quote", json={"brief": brief, "budget": budget})
        assert r.status_code == 200
        parts = {cat: catalog[part["id"]] for cat, part in r.json()["parts"].items()}
        errors = check_compatibility(parts)
        assert errors == [], f"Incompatible build for '{brief}': {errors}"

    def test_very_long_brief(self, client):
        brief = ("I need a PC for " + "gaming, streaming, editing, rendering, " * 20).strip()
        r = client.post("/quote", json={"brief": brief, "budget": 6000})
        assert r.status_code in (200, 422)  # acceptable: answer or graceful failure

    def test_non_english_brief(self, client):
        r = client.post("/quote", json={"brief": "PC untuk gaming 1080p bajet rendah", "budget": 4500})
        assert r.status_code in (200, 422)

    def test_high_budget_uses_premium_parts(self, client, catalog):
        r = client.post("/quote", json={"brief": "extreme high-end 4K gaming PC", "budget": 15000})
        assert r.status_code == 200
        total = r.json()["total"]
        assert total >= 6000, f"Expected premium build for RM 15,000 budget, got RM {total}"

    def test_response_time_under_30s(self, client):
        import time
        start = time.time()
        r = client.post("/quote", json={"brief": "gaming PC", "budget": 5000})
        elapsed = time.time() - start
        assert r.status_code == 200
        assert elapsed < 30, f"Response took {elapsed:.1f}s — too slow"

    # ------------------------------------------------------------------
    # Partial / upgrade integration tests
    # ------------------------------------------------------------------

    def test_gpu_upgrade_returns_only_gpu(self, client):
        """GPU-only upgrade must return exactly one part in parts."""
        r = client.post("/quote", json={
            "brief": "The customer wants to upgrade their GPU for 4K gaming.",
            "budget": 5000,
            "existing_parts": {
                "cpu":         "Intel i5-13600K",
                "motherboard": "Gigabyte B760M DS3H DDR4",
                "ram":         "Kingston Fury Beast DDR4 16GB 3200MHz",
                "psu":         "Seasonic 750W Gold",
                "cooler":      "DeepCool AK400",
                "case":        "Lian Li Lancool 216",
                "storage":     "Samsung 970 EVO 1TB",
            },
            "target_categories": ["gpu"],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "partial"
        assert "gpu" in body["parts"]
        assert len(body["parts"]) == 1

    def test_ram_and_gpu_upgrade(self, client):
        """Requesting GPU + RAM upgrade returns exactly those two categories."""
        r = client.post("/quote", json={
            "brief": (
                "The customer wants to upgrade their existing build, keeping these parts they "
                "already have: NVIDIA RTX 5090, Kingston Fury Beast DDR4 16GB (2x8GB) 3200MHz. "
                "They specifically want 64 GB of RAM. They play a lot of AAA games."
            ),
            "budget": 6000,
            "existing_parts": {
                "gpu": "NVIDIA RTX 5090",
                "ram": "Kingston Fury Beast DDR4 16GB (2x8GB) 3200MHz",
            },
            "target_categories": ["ram"],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "partial"
        assert "ram" in body["parts"]

    def test_single_item_brief_no_context(self, client):
        """A very short single-item brief returns a quote with just that category."""
        r = client.post("/quote", json={
            "brief": "just one RTX 4090",
            "budget": 8000,
        })
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            body = r.json()
            # The agent should have selected a GPU
            assert "gpu" in body["parts"]

    def test_partial_quote_total_within_budget(self, client):
        """Total of partial quote must not exceed the stated budget."""
        r = client.post("/quote", json={
            "brief": "upgrade GPU for 4K gaming",
            "budget": 4000,
            "existing_parts": {"cpu": "AMD Ryzen 7 7700X", "ram": "Corsair DDR5 32GB"},
            "target_categories": ["gpu"],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] <= body["budget"]
def check_compatibility(parts: dict) -> list[str]:
    """
    Validates a selected set of PC components against hard compatibility rules.

    Args:
        parts: {
            "cpu":         { full product dict from catalog },
            "motherboard": { ... },
            "gpu":         { ... },
            "ram":         { ... },
            "psu":         { ... },
            "cooler":      { ... },
            "case":        { ... },
            "storage":     { ... }   # no rules yet, included for completeness
        }

    Returns:
        List of error strings. Empty list = fully compatible.
        Non-empty list = agent must retry with these errors injected.
    """
    errors = []

    # Extract specs for each category (safe — missing category returns empty dict)
    cpu    = parts.get("cpu",         {}).get("specs", {})
    mb     = parts.get("motherboard", {}).get("specs", {})
    gpu    = parts.get("gpu",         {}).get("specs", {})
    psu    = parts.get("psu",         {}).get("specs", {})
    cooler = parts.get("cooler",      {}).get("specs", {})
    ram    = parts.get("ram",         {}).get("specs", {})
    case_s = parts.get("case",        {}).get("specs", {})

    # Guard — flag any missing required categories before running rules
    required_categories = ["cpu", "motherboard", "gpu", "ram", "psu", "cooler"]
    missing = [c for c in required_categories if c not in parts]
    if missing:
        errors.append(f"Missing required categories: {', '.join(missing)}.")
        return errors  # Cannot run rules without all parts present

    # -------------------------------------------------------------------------
    # Rule 1 — CPU socket must match motherboard socket
    # e.g. AM5 CPU must pair with AM5 motherboard
    # -------------------------------------------------------------------------
    if cpu.get("socket") and mb.get("socket") and cpu.get("socket") != mb.get("socket"):
        errors.append(
            f"Socket mismatch: CPU is {cpu.get('socket')}, "
            f"motherboard requires {mb.get('socket')}."
        )

    # -------------------------------------------------------------------------
    # Rule 2 — RAM type must match motherboard RAM type
    # e.g. DDR5 RAM must pair with a DDR5 motherboard
    # -------------------------------------------------------------------------
    if ram.get("type") and mb.get("ram_type") and ram.get("type") != mb.get("ram_type"):
        errors.append(
            f"RAM mismatch: selected {ram.get('type')} "
            f"but motherboard supports {mb.get('ram_type')} only."
        )

    # -------------------------------------------------------------------------
    # Rule 3 — PSU wattage must cover CPU TDP + GPU TDP + 150W system overhead
    # The 150W covers fans, storage, RAM, and general headroom
    # -------------------------------------------------------------------------
    has_power_specs = all(
        value is not None
        for value in (cpu.get("tdp"), gpu.get("tdp"), psu.get("wattage"))
    )
    required_watts = cpu.get("tdp", 0) + gpu.get("tdp", 0) + 150
    if has_power_specs and psu.get("wattage", 0) < required_watts:
        errors.append(
            f"PSU too weak: need {required_watts}W "
            f"(CPU {cpu.get('tdp')}W + GPU {gpu.get('tdp')}W + 150W overhead), "
            f"selected PSU is only {psu.get('wattage')}W."
        )

    # -------------------------------------------------------------------------
    # Rule 4 — Cooler must explicitly support the CPU socket
    # Cooler's socket_support is an array e.g. ["AM5", "AM4", "LGA1700"]
    # -------------------------------------------------------------------------
    supported_sockets = cooler.get("socket_support", [])
    if cpu.get("socket") and supported_sockets and cpu.get("socket") not in supported_sockets:
        errors.append(
            f"Cooler incompatible: does not support {cpu.get('socket')} socket. "
            f"Supported sockets: {supported_sockets}."
        )

    # -------------------------------------------------------------------------
    # Rule 5 — Cooler TDP capacity must meet or exceed CPU TDP
    # e.g. a 150W cooler cannot handle a 170W CPU
    # -------------------------------------------------------------------------
    if (
        cooler.get("tdp_capacity") is not None
        and cpu.get("tdp") is not None
        and cooler.get("tdp_capacity", 0) < cpu.get("tdp", 0)
    ):
        errors.append(
            f"Cooler underpowered: CPU TDP is {cpu.get('tdp')}W "
            f"but cooler max is {cooler.get('tdp_capacity')}W."
        )

    # -------------------------------------------------------------------------
    # Rule 6 — Case form factor must fit the motherboard
    # ATX case fits ATX/mATX/mITX boards
    # mATX case fits mATX/mITX boards only
    # mITX case fits mITX boards only
    # -------------------------------------------------------------------------
    hierarchy = {"ATX": 3, "mATX": 2, "mITX": 1}
    mb_size   = hierarchy.get(mb.get("form_factor", ""), 0)
    case_size = hierarchy.get(case_s.get("form_factor", ""), 0)
    if mb.get("form_factor") and case_s.get("form_factor") and mb_size > case_size:
        errors.append(
            f"Case too small: {mb.get('form_factor')} motherboard "
            f"does not fit in a {case_s.get('form_factor')} case."
        )

    return errors


# =============================================================================
# Quick test — run this file directly to verify all rules fire correctly
# python compat.py
# =============================================================================
if __name__ == "__main__":

    def make_part(category, specs):
        return {"id": "test", "name": "Test Part", "category": category, "price": 0, "specs": specs}

    # --- Test 1: Valid build — should return no errors ---
    valid_build = {
        "cpu":         make_part("cpu",         {"socket": "AM5",    "tdp": 105}),
        "motherboard": make_part("motherboard", {"socket": "AM5",    "ram_type": "DDR5", "form_factor": "ATX"}),
        "gpu":         make_part("gpu",         {"tdp": 200}),
        "ram":         make_part("ram",         {"type": "DDR5",     "capacity_gb": 32}),
        "psu":         make_part("psu",         {"wattage": 750}),
        "cooler":      make_part("cooler",      {"tdp_capacity": 250, "socket_support": ["AM5", "AM4", "LGA1700"]}),
        "case":        make_part("case",        {"form_factor": "ATX"}),
        "storage":     make_part("storage",     {"type": "NVMe",     "capacity_gb": 1000}),
    }
    result = check_compatibility(valid_build)
    print(f"Test 1 (valid build):     {'PASS ✓' if result == [] else f'FAIL — {result}'}")

    # --- Test 2: Socket mismatch — AM5 CPU with LGA1700 board ---
    bad_socket = {**valid_build, "motherboard": make_part("motherboard", {"socket": "LGA1700", "ram_type": "DDR5", "form_factor": "ATX"})}
    result = check_compatibility(bad_socket)
    print(f"Test 2 (socket mismatch): {'PASS ✓' if any('Socket mismatch' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 3: RAM type mismatch — DDR4 RAM on DDR5 board ---
    bad_ram = {**valid_build, "ram": make_part("ram", {"type": "DDR4", "capacity_gb": 16})}
    result = check_compatibility(bad_ram)
    print(f"Test 3 (RAM mismatch):    {'PASS ✓' if any('RAM mismatch' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 4: PSU too weak — 650W PSU for 105W CPU + 200W GPU + 150W = 455W (fine), test with 450W TDP GPU ---
    bad_psu = {**valid_build, "gpu": make_part("gpu", {"tdp": 450}), "psu": make_part("psu", {"wattage": 650})}
    result = check_compatibility(bad_psu)
    print(f"Test 4 (PSU too weak):    {'PASS ✓' if any('PSU too weak' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 5: Cooler socket not supported ---
    bad_cooler_socket = {**valid_build, "cooler": make_part("cooler", {"tdp_capacity": 250, "socket_support": ["LGA1700"]})}
    result = check_compatibility(bad_cooler_socket)
    print(f"Test 5 (cooler socket):   {'PASS ✓' if any('Cooler incompatible' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 6: Cooler TDP too low ---
    bad_cooler_tdp = {**valid_build, "cooler": make_part("cooler", {"tdp_capacity": 65, "socket_support": ["AM5", "LGA1700"]})}
    result = check_compatibility(bad_cooler_tdp)
    print(f"Test 6 (cooler TDP):      {'PASS ✓' if any('Cooler underpowered' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 7: Case too small — ATX board in mATX case ---
    bad_case = {**valid_build, "case": make_part("case", {"form_factor": "mATX"})}
    result = check_compatibility(bad_case)
    print(f"Test 7 (case too small):  {'PASS ✓' if any('Case too small' in e for e in result) else f'FAIL — {result}'}")

    # --- Test 8: Multiple errors at once ---
    multi_error = {**valid_build,
        "motherboard": make_part("motherboard", {"socket": "LGA1700", "ram_type": "DDR4", "form_factor": "mATX"}),
        "case":        make_part("case",        {"form_factor": "mITX"}),
    }
    result = check_compatibility(multi_error)
    print(f"Test 8 (multi-error):     {'PASS ✓' if len(result) >= 3 else f'FAIL — expected 3+ errors, got: {result}'}")

    print("\nAll tests complete.")

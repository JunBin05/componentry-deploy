from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio, json, random, string, time
from typing import Any
from agent import generate_quote
from brief_parser import parse_brief
from catalog_store import display_category, load_catalog, normalize_category
from compat import check_compatibility

app = FastAPI()
app.add_middleware(CORSMiddleware,
                   allow_origins=["*"],
                   allow_methods=["*"],
                   allow_headers=["*"])


class QuoteRequest(BaseModel):
    brief:  str
    budget: float
    # Optional — when provided, the agent runs in partial/upgrade mode.
    # existing_parts: free-text or minimal dict descriptions of parts the
    #   client already owns, keyed by category.  The LLM uses these for
    #   context (socket/RAM compatibility) but they are NOT included in
    #   the quote output.
    # target_categories: explicit list of categories to quote.  If omitted
    #   the LLM infers them from the brief.
    existing_parts:     dict[str, Any] | None = None
    target_categories:  list[str] | None      = None


class CompatRequest(BaseModel):
    items: list[dict]

COMPAT_REQUIRED_CATEGORIES = {"cpu", "motherboard", "gpu", "ram", "psu", "cooler", "case"}

def _catalog_lookup(catalog: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup = {}
    for product_id, product in catalog.items():
        lookup[str(product_id).lower()] = product
        lookup[str(product.get("id", "")).lower()] = product
        lookup[str(product.get("sku", "")).lower()] = product
    return {key: value for key, value in lookup.items() if key}

def _enrich_component(component: dict[str, Any], lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    candidate_keys = [
        component.get("id"),
        component.get("sku"),
        component.get("product_id"),
    ]
    product = next(
        (
            lookup.get(str(key).lower())
            for key in candidate_keys
            if key is not None and lookup.get(str(key).lower())
        ),
        None,
    )
    if not product:
        return component

    enriched = {**product, **component}
    if not component.get("specs"):
        enriched["specs"] = product.get("specs", {})
    if not component.get("category"):
        enriched["category"] = product.get("category")
    return enriched

def _spec(parts: dict[str, dict[str, Any]], category: str, key: str) -> Any:
    return parts.get(category, {}).get("specs", {}).get(key)

def _compat_check_report(parts: dict[str, dict[str, Any]], errors: list[str], warnings: list[str]) -> list[dict[str, str]]:
    if any(error.startswith("Missing required categories") for error in errors):
        return [{
            "label": "Required parts",
            "status": "failed",
            "message": errors[0],
        }]

    checks = []

    cpu_socket = _spec(parts, "cpu", "socket")
    mb_socket = _spec(parts, "motherboard", "socket")
    if cpu_socket and mb_socket:
        checks.append({
            "label": "CPU and motherboard socket",
            "status": "passed" if cpu_socket == mb_socket else "failed",
            "message": f"CPU socket {cpu_socket} {'matches' if cpu_socket == mb_socket else 'does not match'} motherboard socket {mb_socket}.",
        })

    ram_type = _spec(parts, "ram", "type")
    mb_ram = _spec(parts, "motherboard", "ram_type")
    if ram_type and mb_ram:
        checks.append({
            "label": "RAM type",
            "status": "passed" if ram_type == mb_ram else "failed",
            "message": f"Selected RAM is {ram_type}; motherboard supports {mb_ram}.",
        })

    cpu_tdp = _spec(parts, "cpu", "tdp")
    gpu_tdp = _spec(parts, "gpu", "tdp")
    psu_watts = _spec(parts, "psu", "wattage")
    if cpu_tdp is not None and gpu_tdp is not None and psu_watts is not None:
        required_watts = cpu_tdp + gpu_tdp + 150
        checks.append({
            "label": "PSU headroom",
            "status": "passed" if psu_watts >= required_watts else "failed",
            "message": f"Build needs {required_watts}W including 150W overhead; selected PSU provides {psu_watts}W.",
        })

    cooler_sockets = _spec(parts, "cooler", "socket_support") or []
    if cpu_socket and cooler_sockets:
        checks.append({
            "label": "Cooler socket support",
            "status": "passed" if cpu_socket in cooler_sockets else "failed",
            "message": f"Cooler support list is {cooler_sockets}; CPU socket is {cpu_socket}.",
        })

    cooler_tdp = _spec(parts, "cooler", "tdp_capacity")
    if cpu_tdp is not None and cooler_tdp is not None:
        checks.append({
            "label": "Cooler TDP capacity",
            "status": "passed" if cooler_tdp >= cpu_tdp else "failed",
            "message": f"CPU TDP is {cpu_tdp}W; cooler capacity is {cooler_tdp}W.",
        })

    hierarchy = {"ATX": 3, "mATX": 2, "mITX": 1}
    mb_form = _spec(parts, "motherboard", "form_factor")
    case_form = _spec(parts, "case", "form_factor")
    if mb_form and case_form:
        fits = hierarchy.get(mb_form, 0) <= hierarchy.get(case_form, 0)
        checks.append({
            "label": "Case fit",
            "status": "passed" if fits else "failed",
            "message": f"Motherboard form factor is {mb_form}; case form factor is {case_form}.",
        })

    if warnings and not checks:
        checks.append({
            "label": "Catalog specs",
            "status": "warning",
            "message": warnings[0],
        })

    return checks

def build_quote_response(req: QuoteRequest, result: dict, catalog: dict) -> dict:
    enriched = {}
    total = 0
    for category, pid in result["selected"].items():
        product = catalog.get(pid, {})
        price = product.get("price", 0)
        total += price
        enriched[category] = {
            "id": pid,
            "name": product.get("name", pid),
            "part_name": product.get("part_name") or product.get("name", pid),
            "sku": product.get("sku", pid),
            "price": price,
            "category": product.get("display_category") or display_category(category),
            "stock_level": product.get("stock_level", 0),
            "icon": product.get("icon", "hardware"),
            "specs": product.get("specs", {}),
            "reasoning": result["reasoning"].get(category, ""),
            "alternatives": result["alternatives"].get(category, {})
        }

    quote_id = "NX-" + "".join(
        random.choices(string.ascii_uppercase + string.digits, k=6)
    )

    return {
        "quote_id": quote_id,
        "brief": req.brief,
        "budget": req.budget,
        "total": total,
        "savings": req.budget - total,
        # mode is stamped by the agent onto result — it knows which prompt ran
        "mode": result.get("mode", "full"),
        # warnings is non-empty when the agent returned its best imperfect build.
        # The frontend should surface these as a visible caveat.
        "warnings": result.get("warnings", []),
        "existing_parts": req.existing_parts or {},
        "parts": enriched,
        "generated_at": time.strftime("%Y-%m-%d %H:%M")
    }

def _validate_quote_request(req: QuoteRequest) -> None:
    """
    Shared validation for both /quote and /quote/stream.

    Also runs the brief parser when the caller has not supplied structured
    intent fields (i.e. a plain frontend text-field submission). The parser
    result is written back onto req so both route handlers see it without
    any further changes.
    """
    if req.budget < 3800:
        raise HTTPException(400, "Minimum budget is RM 3,800.")
    if not req.brief.strip():
        raise HTTPException(400, "Brief cannot be empty.")

    # If the caller already sent structured fields, normalise and trust them.
    # Otherwise run the brief parser to extract intent from the free text.
    if req.existing_parts is not None or req.target_categories is not None:
        if req.target_categories is not None:
            normalised = [normalize_category(c) for c in req.target_categories]
            req.target_categories = [c for c in normalised if c]
    else:
        parsed = parse_brief(req.brief)
        req.existing_parts    = parsed["existing_parts"]    # {} for full builds
        req.target_categories = parsed["target_categories"] # [] for full builds

@app.post("/quote")
async def create_quote(req: QuoteRequest):
    _validate_quote_request(req)

    try:
        catalog, inventory = load_catalog(require_specs=True)
        result = generate_quote(
            req.brief,
            req.budget,
            catalog,
            inventory,
            existing_parts=req.existing_parts,
            target_categories=req.target_categories,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    return build_quote_response(req, result, catalog)

@app.post("/quote/stream")
async def stream_quote(req: QuoteRequest):
    _validate_quote_request(req)

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def on_status(event: dict):
            asyncio.run_coroutine_threadsafe(queue.put(event), loop)

        async def run_agent():
            try:
                catalog, inventory = load_catalog(require_specs=True)
                result = await loop.run_in_executor(
                    None,
                    lambda: generate_quote(
                        req.brief,
                        req.budget,
                        catalog,
                        inventory,
                        on_status,
                        existing_parts=req.existing_parts,
                        target_categories=req.target_categories,
                    ),
                )
                final = build_quote_response(req, result, catalog)
                await queue.put({"step": "result", "data": final})
            except ValueError as e:
                await queue.put({"step": "error", "message": str(e)})
            except RuntimeError as e:
                await queue.put({"step": "error", "message": str(e)})

        asyncio.create_task(run_agent())

        heartbeat_messages = [
            "Gemini is evaluating compatible part combinations...",
            "Still waiting for Gemini; keeping the quote stream alive...",
            "Cross-checking budget and engineering constraints...",
            "The model is still reasoning through the catalog...",
        ]
        heartbeat_idx = 0

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=4)
            except asyncio.TimeoutError:
                event = {
                    "step": "heartbeat",
                    "message": heartbeat_messages[heartbeat_idx % len(heartbeat_messages)],
                }
                heartbeat_idx += 1
            yield f"data: {json.dumps(event)}\n\n"
            if event["step"] in ("result", "error"):
                break

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/catalog")
async def get_catalog():
    try:
        catalog, _ = load_catalog()
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return list(catalog.values())

@app.post("/compat")
async def check_parts(req: CompatRequest):
    try:
        catalog, _ = load_catalog()
        lookup = _catalog_lookup(catalog)
    except RuntimeError:
        lookup = {}

    parts = {}
    missing_specs = []
    for item in req.items:
        component = item.get("component", item)
        component = _enrich_component(component, lookup)
        category = normalize_category(component.get("category"))
        if category:
            parts[category] = component
        if category in COMPAT_REQUIRED_CATEGORIES and not component.get("specs"):
            missing_specs.append(component.get("part_name") or component.get("name") or component.get("sku"))

    errors = check_compatibility(parts)
    warnings = []
    if missing_specs:
        warnings.append(
            "Compatibility could not be fully verified because these required components are missing specs: "
            + ", ".join(sorted(set(filter(None, missing_specs))))
            + "."
        )
    checks = _compat_check_report(parts, errors, warnings)
    compatible = len(errors) == 0 and not missing_specs
    return {
        "compatible": compatible,
        "verifier": "rules_engine",
        "summary": (
            "Rule-based compatibility verification passed. No blocking issues were found across socket, RAM, PSU, cooler, and case-fit checks."
            if compatible
            else "Rule-based compatibility verification found issues that need review before confirming the quote."
        ),
        "checks": checks,
        "errors": errors,
        "warnings": warnings,
    }
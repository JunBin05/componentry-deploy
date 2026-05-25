import json, re
import os
from dotenv import load_dotenv
from google import genai
from compat import check_compatibility

load_dotenv()

# ---------------------------------------------------------------------------
# System prompt — full build mode
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_FULL = """
You are a technical sales engineer at a PC hardware supplier.
Select one product per category that fits the client brief within budget.

CRITICAL: The client brief may mention parts they already own. IGNORE those
when choosing — you must still select a product for EVERY category from the
AVAILABLE CATALOG below. Every value in "selected" MUST be a product_id key
that exists verbatim in the AVAILABLE CATALOG. Never invent IDs, never use
product names as IDs, never use UUIDs unless they appear in the catalog.

RULES:
- Select exactly one product per category: cpu, motherboard, gpu, ram, storage, psu, cooler, case
- Total price must not exceed the budget
- Only select products where stock > 0
- CPU socket MUST match motherboard socket
- RAM type MUST match motherboard RAM type
- PSU wattage must exceed CPU TDP + GPU TDP + 150W overhead
- Cooler must support the CPU socket

Return ONLY valid JSON. No explanation, no markdown:
{
  "selected": {
    "cpu":         "<product_id from catalog>",
    "motherboard": "<product_id from catalog>",
    "gpu":         "<product_id from catalog>",
    "ram":         "<product_id from catalog>",
    "storage":     "<product_id from catalog>",
    "psu":         "<product_id from catalog>",
    "cooler":      "<product_id from catalog>",
    "case":        "<product_id from catalog>"
  },
  "reasoning": {
    "cpu":         "One sentence why.",
    "motherboard": "One sentence why.",
    "gpu":         "One sentence why.",
    "ram":         "One sentence why.",
    "storage":     "One sentence why.",
    "psu":         "One sentence why.",
    "cooler":      "One sentence why.",
    "case":        "One sentence why."
  },
  "alternatives": {
    "cpu":         { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "motherboard": { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "gpu":         { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "ram":         { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "storage":     { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "psu":         { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "cooler":      { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } },
    "case":        { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } }
  }
}
"""

# ---------------------------------------------------------------------------
# System prompt — partial upgrade / single-item mode
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_PARTIAL = """
You are a technical sales engineer at a PC hardware supplier.
The client already owns some parts and only wants to buy specific new parts.

CRITICAL ID RULE: Every value in "selected" MUST be a product_id key that
exists verbatim in the AVAILABLE CATALOG. Never invent IDs, never use product
names as IDs, never reference existing parts in "selected".

RULES:
- Select products ONLY for the categories listed under "CATEGORIES TO QUOTE".
- Do NOT include any other category in "selected", "reasoning", or "alternatives".
- The client's existing parts (under "EXISTING PARTS") are context only —
  they must NEVER appear in "selected".
- Only select products where stock > 0.
- Consider the client's existing parts when choosing for compatibility:
    - CPU socket MUST match motherboard socket across old and new parts.
    - RAM type MUST match motherboard RAM type across old and new parts.
    - PSU wattage must cover total system TDP (existing + new parts) + 150W overhead.
    - Cooler must support the CPU socket.
- If the client named a specific product they want, find the closest matching
  product_id in the catalog and select it. If that exact model is not in stock,
  say so in the reasoning and recommend the best available alternative instead.
- Total price of the NEW parts only must not exceed the budget (if provided).

Return ONLY valid JSON. No explanation, no markdown.
Only include the categories you are quoting in all three objects:
{
  "selected": {
    "<category>": "<product_id from catalog>"
  },
  "reasoning": {
    "<category>": "One sentence why."
  },
  "alternatives": {
    "<category>": { "down": { "id": "<product_id>", "tradeoff": "What they save and lose." }, "up": { "id": "<product_id>", "tradeoff": "What they gain and pay more." } }
  }
}
"""

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def _detect_mode(existing_parts: dict | None, target_categories: list[str] | None) -> str:
    if existing_parts or target_categories:
        return "partial"
    return "full"


def _check_hallucinated_ids(selected: dict, available: dict) -> list[str]:
    """
    Return a list of error strings for any selected ID that is not in the
    available catalog.  These are hard errors — the model hallucinated an ID.
    """
    bad = []
    for category, pid in selected.items():
        if pid not in available:
            bad.append(
                f"'{pid}' is not a valid product_id for category '{category}'. "
                f"You MUST use an id that exists verbatim in the AVAILABLE CATALOG."
            )
    return bad


def generate_quote(
    brief: str,
    budget: float,
    catalog: dict,
    inventory: dict,
    on_status=None,
    *,
    existing_parts: dict | None = None,
    target_categories: list[str] | None = None,
) -> dict:
    """
    Generate a quote.

    Parameters
    ----------
    brief : str
        Free-text client brief. May be long ("upgrade my GPU and RAM for 4K
        gaming, keeping my RTX 5090") or very short ("just one RTX 5060").
    budget : float
        Maximum spend in RM. For partial quotes this caps the new parts only.
    catalog : dict
        Full product catalog keyed by product ID.
    inventory : dict
        Stock levels keyed by product ID.
    on_status : callable, optional
        SSE status callback; receives a dict with at least {"step", "message"}.
    existing_parts : dict, optional
        Parts the client already owns, keyed by category. Values are free-text
        descriptions passed to the LLM as read-only context for compatibility.
        Example: {"gpu": "NVIDIA RTX 5090", "ram": "Kingston Fury Beast DDR4 16GB"}
    target_categories : list[str], optional
        Categories the client explicitly wants to buy. If omitted, the LLM
        infers from the brief which categories to quote.
    """

    def emit(step: str, message: str, **extra):
        print(f"[{step}] {message}")
        if on_status:
            on_status({"step": step, "message": message, **extra})

    mode = _detect_mode(existing_parts, target_categories)

    # ------------------------------------------------------------------
    # Step 1 — filter to in-stock products only
    # ------------------------------------------------------------------
    emit("filtering", "Scanning inventory for in-stock products...")
    available = {
        pid: product
        for pid, product in catalog.items()
        if inventory.get(pid, {}).get("stock", 0) > 0
    }
    emit("filtering", f"{len(available)} products available across all categories.")

    # ------------------------------------------------------------------
    # Step 2 — build the initial user message
    # ------------------------------------------------------------------
    if mode == "full":
        system_prompt = SYSTEM_PROMPT_FULL
        user_message = (
            f"CLIENT BRIEF: {brief}\n"
            f"BUDGET: RM {budget:,.0f}\n"
            f"AVAILABLE CATALOG: {json.dumps(available)}\n\n"
            f"Total of all selected parts must be <= RM {budget:,.0f}.\n"
            f"Every product_id in 'selected' must be a key from AVAILABLE CATALOG above."
        )
    else:
        system_prompt = SYSTEM_PROMPT_PARTIAL
        existing_section = ""
        if existing_parts:
            existing_section = (
                "\n\nEXISTING PARTS (client already owns — do NOT put these in 'selected'):\n"
                + json.dumps(existing_parts, indent=2)
            )
        categories_section = ""
        if target_categories:
            categories_section = (
                "\n\nCATEGORIES TO QUOTE (select products for these categories ONLY):\n"
                + ", ".join(target_categories)
            )
        budget_section = f"\n\nBUDGET FOR NEW PARTS: RM {budget:,.0f}" if budget else ""
        user_message = (
            f"CLIENT BRIEF: {brief}"
            f"{existing_section}"
            f"{categories_section}"
            f"{budget_section}\n\n"
            f"AVAILABLE CATALOG: {json.dumps(available)}\n"
            f"Every product_id in 'selected' must be a key from AVAILABLE CATALOG above."
        )

    # best_candidate tracks the least-flawed within-budget result seen so far,
    # so we can always return something useful even if no perfect build is found.
    best_candidate: dict | None = None

    def _is_better(new_errors: list) -> bool:
        return best_candidate is None or len(new_errors) < len(best_candidate["errors"])

    for attempt in range(3):

        # ------------------------------------------------------------------
        # Step 3 — call the LLM
        # ------------------------------------------------------------------
        emit("ai", f"Asking Gemini to select parts (attempt {attempt + 1}/3)...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message,
            config={"system_instruction": system_prompt},
        )
        emit("ai", "Gemini responded. Parsing selection...")

        raw = response.text

        # ------------------------------------------------------------------
        # Step 4 — parse JSON (strip markdown fences if present)
        # ------------------------------------------------------------------
        cleaned = re.sub(r"```json|```", "", raw).strip()
        result  = json.loads(cleaned)

        # ------------------------------------------------------------------
        # Step 5 — reject hallucinated product IDs immediately
        # This catches cases like the model using a product name or UUID
        # as an ID instead of a real catalog key.
        # ------------------------------------------------------------------
        hallucination_errors = _check_hallucinated_ids(result["selected"], available)
        if hallucination_errors:
            emit("resolving", f"Hallucinated IDs detected: {hallucination_errors}. Retrying...")
            user_message += (
                f"\n\nERROR — invalid product IDs returned. Fix these:\n"
                + "\n".join(f"- {e}" for e in hallucination_errors)
                + "\nAll IDs must be exact keys from the AVAILABLE CATALOG."
            )
            continue

        # ------------------------------------------------------------------
        # Step 6 — resolve product IDs to full product objects
        # ------------------------------------------------------------------
        emit("resolving", "Resolving product IDs from catalog...")
        parts = {
            category: available[pid]
            for category, pid in result["selected"].items()
        }
        for cat, pid in result["selected"].items():
            name = available[pid].get("name", pid)
            emit("resolving", f"  {cat}: {name}", category=cat, product_id=pid, product_name=name)

        # ------------------------------------------------------------------
        # Step 7 — check budget
        # ------------------------------------------------------------------
        total = sum(p.get("price", 0) for p in parts.values())
        emit("budget", f"Calculating total cost... RM {total:,.0f} / RM {budget:,.0f}", total=total, budget=budget)
        if total > budget:
            overage = total - budget
            emit("budget", f"Over budget by RM {overage:,.0f}. Retrying with cheaper parts.", overage=overage)
            # Over-budget results are not tracked — the price ceiling is hard.
            user_message += (
                f"\n\nBudget exceeded by RM {overage:,.0f} "
                f"(total RM {total:,.0f}, limit RM {budget:,.0f}). Choose cheaper parts."
            )
            continue

        emit("budget", f"Budget OK. RM {budget - total:,.0f} remaining.", savings=budget - total)

        # ------------------------------------------------------------------
        # Step 8 — compatibility check (full-build mode only)
        # Partial mode skips this: compat.py requires all 7 categories and
        # would always error on a 1- or 2-part quote.
        # ------------------------------------------------------------------
        if mode == "full":
            emit("compat", "Running compatibility checks...")
            emit("compat", "  Checking CPU and motherboard socket...")
            emit("compat", "  Checking RAM type...")
            emit("compat", "  Checking PSU wattage...")
            emit("compat", "  Checking cooler socket support & TDP...")
            emit("compat", "  Checking case form factor...")
            errors = check_compatibility(parts)

            if not errors:
                emit("done", "All checks passed. Build is valid!", total=total)
                result["mode"] = "full"
                return result

            # Within budget but imperfect — track as best candidate so far.
            if _is_better(errors):
                best_candidate = {"result": result, "errors": errors}

            emit("compat", f"Compatibility issues found: {errors}. Retrying...", errors=errors)
            user_message += f"\n\nFix these compatibility issues: {errors}"
        else:
            emit("done", f"Parts selected. RM {total:,.0f} for new items.", total=total)
            result["mode"] = "partial"
            return result

    # ------------------------------------------------------------------
    # All attempts exhausted without a perfect build.
    # Return the best within-budget candidate found, flagged with its
    # remaining issues so the frontend can surface a clear warning.
    # Only raise if every attempt hallucinated IDs or busted the budget
    # (i.e. nothing usable was ever produced).
    # ------------------------------------------------------------------
    if best_candidate is None:
        raise ValueError("Could not generate a usable build after 3 attempts.")

    best_result = best_candidate["result"]
    best_errors = best_candidate["errors"]
    emit(
        "done",
        f"Returning best available build with {len(best_errors)} unresolved compatibility issue(s).",
        warnings=best_errors,
    )
    best_result["mode"] = "full"
    best_result["warnings"] = best_errors
    return best_result
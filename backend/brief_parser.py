"""
brief_parser.py
---------------
Parses a free-text customer brief into structured intent before the quote
agent runs. This is a deliberate single-responsibility module — it answers
only two questions:

  1. Is this a full build or a partial/upgrade/single-item request?
  2. If partial: what existing parts does the customer already own, and
     which categories are they actually asking to buy?

The parser uses a small, fast LLM call with a strict JSON schema so the
output is always machine-readable. The agent then uses the structured
output directly — it never has to guess intent from raw text.
"""

import json
import os
import re

from dotenv import load_dotenv
from google import genai

load_dotenv()

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Valid normalised category names (must match catalog_store.CATEGORY_MAP values)
KNOWN_CATEGORIES = {"cpu", "motherboard", "gpu", "ram", "storage", "psu", "cooler", "case"}

_SYSTEM_PROMPT = """
You are a PC hardware sales assistant. Your only job is to classify a
customer brief and extract structured intent from it.

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "mode": "full" | "partial",
  "existing_parts": {
    "<category>": "<free-text description of the part they already own>"
  },
  "target_categories": ["<category>", ...]
}

RULES:

mode:
  - "full"    → the customer wants a complete new PC build from scratch.
  - "partial" → the customer already owns some parts, wants to upgrade
                specific parts, or is asking about one or a few specific
                items without mentioning building a whole new PC.

existing_parts:
  - Only populate when the customer explicitly mentions parts they currently
    own or want to keep. Use free-text values (e.g. "NVIDIA RTX 5090").
  - Omit a category if the customer did not mention owning it.
  - Empty object {} if mode is "full" or nothing is mentioned as owned.

target_categories:
  - The categories the customer is asking to BUY (not keep).
  - For "partial" mode: list only the categories they want to purchase.
  - For "full" mode: return an empty list [] — the agent will select all.
  - If the customer names a specific product to buy (e.g. "just an RTX 4090"),
    infer the category (gpu) and include it.

Valid category values (use exactly these strings):
  cpu, motherboard, gpu, ram, storage, psu, cooler, case

EXAMPLES:

Brief: "I need a new gaming PC for around RM 5000"
→ { "mode": "full", "existing_parts": {}, "target_categories": [] }

Brief: "just one RTX 4090"
→ { "mode": "partial", "existing_parts": {}, "target_categories": ["gpu"] }

Brief: "upgrade my RAM to 64GB, keeping everything else"
→ { "mode": "partial", "existing_parts": {}, "target_categories": ["ram"] }

Brief: "The customer wants to upgrade their GPU and RAM. They have an Intel
i7-13700K, MSI Z790 motherboard, 32GB DDR5, RTX 3080."
→ {
    "mode": "partial",
    "existing_parts": {
      "cpu": "Intel i7-13700K",
      "motherboard": "MSI Z790",
      "ram": "32GB DDR5",
      "gpu": "RTX 3080"
    },
    "target_categories": ["gpu", "ram"]
  }

Brief: "The customer wants to upgrade their existing build, keeping these
parts they already have: NVIDIA RTX 5090, Kingston Fury Beast DDR4 16GB
(2x8GB) 3200MHz. They specifically want 64 GB of RAM. They play a lot of
AAA games."
→ {
    "mode": "partial",
    "existing_parts": {
      "gpu": "NVIDIA RTX 5090",
      "ram": "Kingston Fury Beast DDR4 16GB (2x8GB) 3200MHz"
    },
    "target_categories": ["ram"]
  }
"""


def parse_brief(brief: str) -> dict:
    """
    Parse a free-text customer brief into structured intent.

    Returns
    -------
    dict with keys:
      mode              : "full" | "partial"
      existing_parts    : dict[category, free-text description]  (may be empty)
      target_categories : list[str]  (normalised category names; empty for full builds)

    Never raises — on any parse failure it returns a safe "full" build default
    so the agent can still run.
    """
    try:
        response = _client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"CUSTOMER BRIEF:\n{brief}",
            config={"system_instruction": _SYSTEM_PROMPT},
        )
        raw = response.text
        cleaned = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(cleaned)
    except Exception as exc:
        # Parsing failure is non-fatal — fall back to full build
        print(f"[brief_parser] parse failed ({exc}), defaulting to full build.")
        return {"mode": "full", "existing_parts": {}, "target_categories": []}

    # --- Validate and sanitise output ---

    mode = parsed.get("mode", "full")
    if mode not in ("full", "partial"):
        mode = "full"

    raw_existing = parsed.get("existing_parts") or {}
    existing_parts = {
        k: v
        for k, v in raw_existing.items()
        if k in KNOWN_CATEGORIES and isinstance(v, str) and v.strip()
    }

    raw_targets = parsed.get("target_categories") or []
    target_categories = [
        c for c in raw_targets
        if isinstance(c, str) and c in KNOWN_CATEGORIES
    ]

    # Consistency fix: if the parser said "full" but there are existing parts
    # or target categories, it clearly should be partial.
    if mode == "full" and (existing_parts or target_categories):
        mode = "partial"

    # Consistency fix: partial with no target_categories — infer from brief by
    # treating any category NOT in existing_parts as a potential target only if
    # the brief mentions upgrading/buying something. If we truly can't tell,
    # leave target_categories empty and let the agent infer from the brief text.

    return {
        "mode": mode,
        "existing_parts": existing_parts,
        "target_categories": target_categories,
    }
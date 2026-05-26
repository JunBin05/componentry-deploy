import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from dotenv import load_dotenv


load_dotenv(Path(__file__).parent / ".env")


CATEGORY_MAP = {
    "cpu": "cpu",
    "processor": "cpu",
    "gpu": "gpu",
    "graphics card": "gpu",
    "motherboard": "motherboard",
    "mainboard": "motherboard",
    "ram": "ram",
    "memory": "ram",
    "storage": "storage",
    "ssd": "storage",
    "hdd": "storage",
    "psu": "psu",
    "power supply": "psu",
    "cooling": "cooler",
    "cooler": "cooler",
    "case": "case",
    "chassis": "case",
    "hardware": "case",
}

DISPLAY_CATEGORY = {
    "cpu": "CPU",
    "gpu": "GPU",
    "motherboard": "Motherboard",
    "ram": "RAM",
    "storage": "Storage",
    "psu": "PSU",
    "cooler": "Cooling",
    "case": "Case",
}


def normalize_category(category: str | None) -> str:
    value = (category or "").strip().lower()
    return CATEGORY_MAP.get(value, value)


def display_category(category: str | None) -> str:
    normalized = normalize_category(category)
    return DISPLAY_CATEGORY.get(normalized, category or "Case")


def _coerce_price(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _coerce_stock(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _row_to_product(row: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, int]]:
    product_id = str(row["id"])
    category = normalize_category(row.get("category"))
    name = row.get("part_name") or row.get("name") or row.get("sku") or product_id
    stock = _coerce_stock(row.get("stock_level", row.get("stock")))
    product = {
        "id": product_id,
        "name": name,
        "part_name": name,
        "category": category,
        "display_category": display_category(category),
        "sku": row.get("sku") or product_id,
        "price": _coerce_price(row.get("price")),
        "stock_level": stock,
        "icon": row.get("icon") or "hardware",
        "specs": row.get("specs") or {},
    }
    return product_id, product, {"stock": stock}


def _fetch_supabase_rows() -> list[dict[str, Any]]:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required.")

    endpoint = urljoin(supabase_url.rstrip("/") + "/", "rest/v1/catalog?select=*")
    request = Request(
        endpoint,
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def _load_local_catalog() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, int]]]:
    base = Path(__file__).parent / "data"
    with (base / "catalog.json").open() as catalog_file:
        catalog = json.load(catalog_file)
    with (base / "inventory.json").open() as inventory_file:
        inventory = json.load(inventory_file)

    for product_id, product in catalog.items():
        product["part_name"] = product.get("part_name") or product.get("name") or product_id
        product["display_category"] = display_category(product.get("category"))
        product["stock_level"] = inventory.get(product_id, {}).get("stock", 0)
        product["sku"] = product.get("sku") or product_id
        product["icon"] = product.get("icon") or "hardware"
    return catalog, inventory


def load_catalog(require_specs: bool = False) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, int]]]:
    """
    Load quote catalog data.

    Supabase is the source of truth when its env vars are configured. The JSON
    fallback keeps local tests and first-run development usable before keys are
    added.
    """
    try:
        rows = _fetch_supabase_rows()
    except Exception as exc:
        if os.environ.get("REQUIRE_SUPABASE") == "true":
            raise RuntimeError(f"Could not fetch Supabase catalog: {exc}") from exc
        return _load_local_catalog()

    catalog: dict[str, dict[str, Any]] = {}
    inventory: dict[str, dict[str, int]] = {}
    for row in rows:
        product_id, product, stock = _row_to_product(row)
        if require_specs and not product.get("specs"):
            continue
        catalog[product_id] = product
        inventory[product_id] = stock
    return catalog, inventory

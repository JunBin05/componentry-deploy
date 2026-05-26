import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).parent


def load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

CATEGORY_MAP = {
    "cpu": "CPU",
    "gpu": "GPU",
    "ram": "RAM",
    "motherboard": "Motherboard",
    "storage": "Storage",
    "psu": "PSU",
    "cooler": "Cooling",
    "case": "Case",
}

ICON_MAP = {
    "cpu": "developer_board",
    "gpu": "videogame_asset",
    "ram": "memory",
    "motherboard": "domain",
    "storage": "storage",
    "psu": "power",
    "cooler": "ac_unit",
    "case": "inventory_2",
}


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def load_rows() -> list[dict]:
    with (BASE_DIR / "data" / "catalog.json").open() as catalog_file:
        catalog = json.load(catalog_file)
    with (BASE_DIR / "data" / "inventory.json").open() as inventory_file:
        inventory = json.load(inventory_file)

    rows = []
    for product_id, item in catalog.items():
        category = item["category"]
        rows.append(
            {
                "part_name": item["name"],
                "category": CATEGORY_MAP.get(category, "Hardware"),
                "sku": product_id.upper(),
                "price": item.get("price", 0),
                "stock_level": inventory.get(product_id, {}).get("stock", 0),
                "icon": ICON_MAP.get(category, "hardware"),
                "specs": item.get("specs", {}),
            }
        )
    return rows


def upsert_rows(rows: list[dict]) -> None:
    supabase_url = env("SUPABASE_URL").rstrip("/")
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or env("SUPABASE_ANON_KEY")
    )
    query = urlencode({"on_conflict": "sku"})
    url = f"{supabase_url}/rest/v1/catalog?{query}"
    request = Request(
        url,
        data=json.dumps(rows).encode("utf-8"),
        method="POST",
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urlopen(request, timeout=30) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError(f"Supabase returned status {response.status}")


if __name__ == "__main__":
    rows = load_rows()
    upsert_rows(rows)
    print(f"Seeded {len(rows)} catalog rows into Supabase.")

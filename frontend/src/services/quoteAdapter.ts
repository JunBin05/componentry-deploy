import { ComponentCategory, ComponentItem, QuoteLineItem } from "../types";
import { PyQuoteResponse } from "./pythonApi";

const CATEGORY_MAP: Record<string, ComponentCategory> = {
  cpu: "CPU",
  gpu: "GPU",
  motherboard: "Motherboard",
  ram: "RAM",
  storage: "Storage",
  psu: "PSU",
  cooler: "Cooling",
  cooling: "Cooling",
  case: "Case",
  hardware: "Case",
};

export const ICON_MAP: Record<string, string> = {
  CPU: "developer_board",
  GPU: "videogame_asset",
  Motherboard: "domain",
  RAM: "memory",
  Storage: "storage",
  PSU: "power",
  Cooling: "ac_unit",
  Case: "inventory_2",
};

const ICON_ALIASES: Record<string, string> = {
  case: "inventory_2",
  chassis: "inventory_2",
  hard_drive: "storage",
  hardware: "inventory_2",
  motherboard: "domain",
  cooler: "ac_unit",
};

const VALID_ICONS = new Set([
  "developer_board",
  "videogame_asset",
  "domain",
  "memory",
  "storage",
  "power",
  "ac_unit",
  "inventory_2",
  "add_circle",
  "search",
  "edit",
  "delete",
  "close",
]);

export function iconForCategory(category?: string): string {
  return ICON_MAP[category || ""] || "inventory_2";
}

export function normalizeIcon(icon?: string | null, category?: string): string {
  const value = (icon || "").trim();
  const aliased = ICON_ALIASES[value] || value;
  if (VALID_ICONS.has(aliased)) return aliased;
  return iconForCategory(category);
}

function normalizeSku(value?: string): string {
  return (value || "").trim().toUpperCase();
}

export function normalizeCategory(category?: string | null): ComponentCategory {
  return CATEGORY_MAP[(category || "").toLowerCase()] ?? "Case";
}

export function hasSpecs(specs?: Record<string, unknown> | null): boolean {
  return !!specs && Object.keys(specs).length > 0;
}

export function displayName(component: Pick<ComponentItem, "part_name"> & { name?: string }): string {
  return component.part_name || component.name || "";
}

export function adaptPyQuoteToLineItems(
  response: PyQuoteResponse,
  supabaseInventory: ComponentItem[]
): QuoteLineItem[] {
  return Object.entries(response.parts).map(([category, part]) => {
    const matched = supabaseInventory.find((item) => {
      return (
        item.id === part.id ||
        (item.sku && part.sku && normalizeSku(item.sku) === normalizeSku(part.sku)) ||
        (item.sku && normalizeSku(item.sku) === normalizeSku(part.id))
      );
    });

    // If matched in database, absolutely trust database category over LLM hallucinated keys
    const finalCategory = matched ? matched.category : normalizeCategory(part.category || category);

    const component: ComponentItem = matched ? {
      ...matched,
      category: finalCategory,
      icon: normalizeIcon(matched.icon || part.icon, finalCategory),
      specs: hasSpecs(matched.specs) ? matched.specs : (part.specs || {}),
    } : {
      id: part.id,
      name: part.name || "",
      part_name: part.part_name || part.name || "",
      sku: part.sku || part.id.toUpperCase(),
      price: part.price || 0,
      category: finalCategory,
      icon: normalizeIcon(part.icon, finalCategory),
      stock_level: part.stock_level ?? 0,
      specs: part.specs || {},
    };

    return {
      component,
      quantity: 1,
      rationale: part.reasoning,
    };
  });
}

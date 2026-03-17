import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { VendorConfig } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, "catalog.json");

let _catalog: VendorConfig[] | null = null;

function loadCatalog(): VendorConfig[] {
  if (!_catalog) {
    const raw = readFileSync(catalogPath, "utf-8");
    _catalog = JSON.parse(raw) as VendorConfig[];
  }
  return _catalog;
}

export function getAllVendors(): VendorConfig[] {
  return loadCatalog();
}

export function getEnabledVendors(): VendorConfig[] {
  return loadCatalog().filter((v) => v.defaultEnabled);
}

export function getVendorById(id: string): VendorConfig | undefined {
  return loadCatalog().find((v) => v.id === id);
}

export function getVendorsByCategory(category: string): VendorConfig[] {
  return loadCatalog().filter((v) => v.category === category);
}

export function searchVendors(query: string): VendorConfig[] {
  const q = query.toLowerCase();
  return loadCatalog().filter(
    (v) => v.id.includes(q) || v.name.toLowerCase().includes(q) || v.category.includes(q)
  );
}

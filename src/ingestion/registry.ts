import type { SourceAdapter } from "../lib/adapters.js";
import { pluginAdapter } from "./plugin-runner.js";
import { rssAdapter, atomAdapter } from "./rss.js";
import { scrapeAdapter } from "./scraper.js";
import { statuspageAdapter } from "./statuspage-api.js";

const sourceRegistry = new Map<string, SourceAdapter>();

/** Register all built-in source adapters. */
function registerDefaults() {
  for (const adapter of [
    statuspageAdapter,
    rssAdapter,
    atomAdapter,
    scrapeAdapter,
    pluginAdapter,
  ]) {
    sourceRegistry.set(adapter.type, adapter);
  }
}

registerDefaults();

/** Look up a source adapter by ingestion type. */
export function getSourceAdapter(type: string): SourceAdapter | undefined {
  return sourceRegistry.get(type);
}

/** Register a custom source adapter at runtime. */
export function registerSourceAdapter(adapter: SourceAdapter): void {
  sourceRegistry.set(adapter.type, adapter);
}

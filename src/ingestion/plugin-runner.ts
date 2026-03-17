import type { SourceAdapter } from "../lib/adapters.js";
import { normalizeFromText } from "../lib/normalize.js";
import { NormalizedStatus } from "../lib/types.js";
import type { ServiceStatus, NormalizedStatusType } from "../lib/types.js";

export interface PluginConfig {
  url: string;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  // JSONPath-like dot notation to extract status from response
  statusPath?: string;
  // Map custom status values to normalized ones
  statusMapping?: Record<string, NormalizedStatusType>;
  // Region to assign
  region?: string;
}

export async function runPlugin(
  pluginId: string,
  vendorId: string,
  config: PluginConfig
): Promise<ServiceStatus> {
  const resp = await fetch(config.url, {
    method: config.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...config.headers,
    },
    body: config.body,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    return {
      vendorId,
      status: NormalizedStatus.Outage,
      description: `Plugin fetch failed: ${resp.status}`,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  const data = await resp.json();

  // Extract status using dot-notation path
  let rawStatus: string;
  if (config.statusPath) {
    rawStatus = getNestedValue(data, config.statusPath) ?? "operational";
  } else {
    rawStatus = data.status?.indicator ?? data.status ?? data.state ?? data.health ?? "operational";
  }

  const statusStr = typeof rawStatus === "string" ? rawStatus : String(rawStatus);

  // Apply custom mapping or default normalization
  let status: NormalizedStatusType;
  if (config.statusMapping && config.statusMapping[statusStr]) {
    status = config.statusMapping[statusStr];
  } else {
    status = normalizeFromText(statusStr);
  }

  return {
    vendorId,
    status,
    description: statusStr,
    lastCheckedAt: new Date().toISOString(),
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

/** Source adapter for custom API plugins. */
export const pluginAdapter: SourceAdapter = {
  type: "custom-api",
  async fetch(_url, vendorId, config) {
    const pluginConfig = config as unknown as PluginConfig;
    return { status: await runPlugin(vendorId, vendorId, pluginConfig) };
  },
};

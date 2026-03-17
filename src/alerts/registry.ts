import type { DestinationAdapter } from "../lib/adapters.js";
import { webhookAdapter } from "./http-webhook.js";
import { slackAdapter } from "./slack.js";
import { teamsAdapter } from "./teams.js";

const destRegistry = new Map<string, DestinationAdapter>();

/** Register all built-in destination adapters. */
function registerDefaults() {
  for (const adapter of [slackAdapter, webhookAdapter, teamsAdapter]) {
    destRegistry.set(adapter.type, adapter);
  }
}

registerDefaults();

/** Look up a destination adapter by alert target type. */
export function getDestAdapter(type: string): DestinationAdapter | undefined {
  return destRegistry.get(type);
}

/** Register a custom destination adapter at runtime. */
export function registerDestAdapter(adapter: DestinationAdapter): void {
  destRegistry.set(adapter.type, adapter);
}

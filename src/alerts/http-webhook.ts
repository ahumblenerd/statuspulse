import { createHmac } from "crypto";
import type { DestinationAdapter } from "../lib/adapters.js";
import type { StatusChangeEvent } from "../lib/types.js";

export async function sendWebhookAlert(
  url: string,
  event: StatusChangeEvent,
  secret?: string
): Promise<void> {
  const body = JSON.stringify({
    event: "status_change",
    vendor_id: event.vendorId,
    vendor_name: event.vendorName,
    previous_status: event.previousStatus,
    current_status: event.currentStatus,
    description: event.description,
    timestamp: event.timestamp,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "StatusPulse/1.0",
  };

  if (secret) {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-StatusPulse-Signature"] = `sha256=${signature}`;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    throw new Error(`Webhook failed: ${resp.status} ${resp.statusText}`);
  }
}

/** Destination adapter for generic HTTP webhooks. */
export const webhookAdapter: DestinationAdapter = {
  type: "webhook",
  send: (config, event) => sendWebhookAlert(config.url, event, config.secret),
};

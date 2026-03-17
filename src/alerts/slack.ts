import type { DestinationAdapter } from "../lib/adapters.js";
import type { StatusChangeEvent } from "../lib/types.js";

const statusEmoji: Record<string, string> = {
  operational: ":large_green_circle:",
  degraded: ":large_yellow_circle:",
  outage: ":red_circle:",
  maintenance: ":wrench:",
};

export async function sendSlackAlert(webhookUrl: string, event: StatusChangeEvent): Promise<void> {
  const emoji = statusEmoji[event.currentStatus] ?? ":question:";
  const prevEmoji = statusEmoji[event.previousStatus] ?? ":question:";

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${event.vendorName} Status Change`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Previous:*\n${prevEmoji} ${event.previousStatus}`,
          },
          {
            type: "mrkdwn",
            text: `*Current:*\n${emoji} ${event.currentStatus}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: event.description || "_No additional details_",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `StatusPulse \u2022 ${new Date(event.timestamp).toLocaleString()}`,
          },
        ],
      },
    ],
  };

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`Slack webhook failed: ${resp.status}`);
  }
}

/** Destination adapter for Slack incoming webhooks. */
export const slackAdapter: DestinationAdapter = {
  type: "slack",
  send: (config, event) => sendSlackAlert(config.url, event),
};

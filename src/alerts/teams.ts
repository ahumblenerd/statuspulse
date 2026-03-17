import type { DestinationAdapter } from "../lib/adapters.js";
import type { StatusChangeEvent } from "../lib/types.js";

const statusColor: Record<string, string> = {
  operational: "Good",
  degraded: "Warning",
  outage: "Attention",
  maintenance: "Accent",
};

/** Send a status-change alert to an MS Teams incoming webhook using Adaptive Card format. */
export async function sendTeamsAlert(webhookUrl: string, event: StatusChangeEvent): Promise<void> {
  const color = statusColor[event.currentStatus] ?? "Default";

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `${event.vendorName} Status Change`,
              style:
                color === "Attention" ? "attention" : color === "Warning" ? "warning" : "default",
            },
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: `**Previous:** ${event.previousStatus}`,
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: `**Current:** ${event.currentStatus}`,
                      wrap: true,
                      color: color,
                    },
                  ],
                },
              ],
            },
            {
              type: "TextBlock",
              text: event.description || "No additional details",
              wrap: true,
              isSubtle: true,
            },
            {
              type: "TextBlock",
              text: `StatusPulse \u2022 ${new Date(event.timestamp).toLocaleString()}`,
              size: "Small",
              isSubtle: true,
            },
          ],
        },
      },
    ],
  };

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new Error(`Teams webhook failed: ${resp.status}`);
  }
}

/** Destination adapter for MS Teams incoming webhooks. */
export const teamsAdapter: DestinationAdapter = {
  type: "teams",
  send: (config, event) => sendTeamsAlert(config.url, event),
};

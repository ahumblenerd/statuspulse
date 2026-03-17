import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { http, HttpResponse } from "msw";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

// Default handlers: all vendors return operational
export const handlers = [
  // Statuspage API endpoints (return operational by default)
  http.get("https://www.githubstatus.com/api/v2/summary.json", () => {
    return HttpResponse.json(JSON.parse(fixture("statuspage-github.json")));
  }),

  http.get("https://status.stripe.com/api/v2/summary.json", () => {
    return HttpResponse.json(JSON.parse(fixture("statuspage-github.json")));
  }),

  http.get("https://www.vercel-status.com/api/v2/summary.json", () => {
    return HttpResponse.json(
      JSON.parse(fixture("statuspage-github.json").replace(/GitHub/g, "Vercel"))
    );
  }),

  http.get("https://www.cloudflarestatus.com/api/v2/summary.json", () => {
    return HttpResponse.json(
      JSON.parse(fixture("statuspage-github.json").replace(/GitHub/g, "Cloudflare"))
    );
  }),

  // RSS endpoints
  http.get("https://status.aws.amazon.com/rss/all.rss", () => {
    return new HttpResponse(fixture("rss-aws.xml"), {
      headers: { "Content-Type": "application/rss+xml" },
    });
  }),

  http.get("https://status.cloud.google.com/en/feed.atom", () => {
    return new HttpResponse(fixture("atom-feed.xml"), {
      headers: { "Content-Type": "application/atom+xml" },
    });
  }),

  // Scrape endpoint
  http.get("https://example.com/status", () => {
    return new HttpResponse(fixture("scrape-page.html"), {
      headers: { "Content-Type": "text/html" },
    });
  }),

  // Plugin endpoint
  http.get("https://internal.example.com/health", () => {
    return HttpResponse.json(JSON.parse(fixture("plugin-response.json")));
  }),

  // Slack webhook (capture outbound)
  http.post("https://hooks.slack.com/services/test", () => {
    return HttpResponse.json({ ok: true });
  }),

  // Generic webhook target (capture outbound)
  http.post("https://webhook.example.com/status", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Anthropic API mock for vision detection
  http.post("https://api.anthropic.com/v1/messages", () => {
    return HttpResponse.json({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            {
              name: "GitHub",
              apparent_status: "operational",
              confidence: 0.95,
            },
            {
              name: "Vercel",
              apparent_status: "degraded",
              confidence: 0.85,
            },
          ]),
        },
      ],
    });
  }),

  // Catch-all for any statuspage-api vendor not explicitly handled
  http.get(/\/api\/v2\/summary\.json$/, ({ request }) => {
    const url = new URL(request.url);
    const pageName = url.hostname.replace("status.", "").replace(".com", "");
    const base = JSON.parse(fixture("statuspage-github.json"));
    base.page.name = pageName;
    return HttpResponse.json(base);
  }),
];

// Scenario-specific handler overrides
export const scenarioHandlers = {
  "github-degraded": [
    http.get("https://www.githubstatus.com/api/v2/summary.json", () => {
      return HttpResponse.json(JSON.parse(fixture("statuspage-github-degraded.json")));
    }),
  ],

  "github-outage": [
    http.get("https://www.githubstatus.com/api/v2/summary.json", () => {
      return HttpResponse.json(JSON.parse(fixture("statuspage-outage.json")));
    }),
  ],

  "aws-outage": [
    http.get("https://status.aws.amazon.com/rss/all.rss", () => {
      // Use dynamic dates so the 24h recency filter in rss.ts always passes
      const now = new Date().toUTCString();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>AWS Service Health Dashboard</title>
<item><title>Service disruption: Amazon EC2 (US-EAST-1)</title>
<description>We are experiencing elevated error rates and unavailable instances in US-EAST-1.</description>
<pubDate>${now}</pubDate><guid>aws-ec2-outage-001</guid></item>
<item><title>Service disruption: Amazon RDS (US-EAST-1)</title>
<description>Database connectivity issues in US-EAST-1 due to underlying infrastructure.</description>
<pubDate>${now}</pubDate><guid>aws-rds-outage-001</guid></item>
</channel></rss>`;
      return new HttpResponse(xml, {
        headers: { "Content-Type": "application/rss+xml" },
      });
    }),
  ],

  "fetch-error": [
    http.get("https://www.githubstatus.com/api/v2/summary.json", () => {
      return new HttpResponse(null, { status: 500 });
    }),
  ],

  timeout: [
    http.get("https://www.githubstatus.com/api/v2/summary.json", async () => {
      await new Promise((r) => setTimeout(r, 20000));
      return HttpResponse.json({});
    }),
  ],

  "malformed-json": [
    http.get("https://www.githubstatus.com/api/v2/summary.json", () => {
      return new HttpResponse("not json at all {{{", {
        headers: { "Content-Type": "application/json" },
      });
    }),
  ],
};

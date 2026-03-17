import { describe, it, expect } from "vitest";
import { fetchRssFeed } from "../../ingestion/rss.js";
import { scenarioHandlers } from "../msw/handlers.js";
import { server } from "../msw/server.js";

describe("fetchRssFeed", () => {
  it("parses RSS 2.0 feed (AWS)", async () => {
    const { status, incidents } = await fetchRssFeed(
      "https://status.aws.amazon.com/rss/all.rss",
      "aws"
    );

    expect(status.vendorId).toBe("aws");
    expect(status.lastCheckedAt).toBeTruthy();
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0].vendorId).toBe("aws");
    expect(incidents[0].title).toBeTruthy();
    expect(incidents[0].updates.length).toBeGreaterThan(0);
  });

  it("parses Atom feed (GCP)", async () => {
    const { status, incidents } = await fetchRssFeed(
      "https://status.cloud.google.com/en/feed.atom",
      "gcp"
    );

    expect(status.vendorId).toBe("gcp");
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0].title).toContain("Cloud SQL");
  });

  it("detects outage from RSS items", async () => {
    server.use(...scenarioHandlers["aws-outage"]);

    const { status, incidents } = await fetchRssFeed(
      "https://status.aws.amazon.com/rss/all.rss",
      "aws"
    );

    // Recent items with "disruption" / "unavailable" should trigger outage
    expect(status.status).toBe("outage");
    expect(incidents.length).toBe(2);
  });

  it("returns operational when no recent incidents", async () => {
    // Default AWS fixture has items from March 14 (> 24h ago for test context)
    const { status } = await fetchRssFeed("https://status.aws.amazon.com/rss/all.rss", "aws");

    // Items from fixture are > 24h old, so status should be operational
    expect(status.status).toBe("operational");
  });

  it("limits incidents to 10", async () => {
    const { incidents } = await fetchRssFeed("https://status.aws.amazon.com/rss/all.rss", "aws");
    expect(incidents.length).toBeLessThanOrEqual(10);
  });

  it("truncates long descriptions", async () => {
    const { incidents } = await fetchRssFeed("https://status.aws.amazon.com/rss/all.rss", "aws");
    for (const inc of incidents) {
      for (const upd of inc.updates) {
        expect(upd.body.length).toBeLessThanOrEqual(500);
      }
    }
  });
});

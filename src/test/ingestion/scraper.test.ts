import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { scrapeStatusPage } from "../../ingestion/scraper.js";
import { server } from "../msw/server.js";

describe("scrapeStatusPage", () => {
  it("scrapes status from default selectors", async () => {
    const status = await scrapeStatusPage("https://example.com/status", "test-vendor");

    expect(status.vendorId).toBe("test-vendor");
    expect(status.status).toBe("operational");
    expect(status.description).toBeTruthy();
    expect(status.lastCheckedAt).toBeTruthy();
  });

  it("uses custom selector when provided", async () => {
    const status = await scrapeStatusPage(
      "https://example.com/status",
      "test-vendor",
      ".page-status .status"
    );

    expect(status.status).toBe("operational");
    expect(status.description).toContain("Operational");
  });

  it("detects degraded from scraped text", async () => {
    const status = await scrapeStatusPage(
      "https://example.com/status",
      "test-vendor",
      ".component-status[data-component-status='degraded']"
    );

    expect(status.status).toBe("degraded");
  });

  it("throws on HTTP error (404)", async () => {
    server.use(
      http.get("https://example.com/missing-page", () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    await expect(
      scrapeStatusPage("https://example.com/missing-page", "test-vendor")
    ).rejects.toThrow("Scrape failed: 404");
  });
});

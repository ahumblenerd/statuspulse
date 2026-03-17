import * as cheerio from "cheerio";
import type { SourceAdapter } from "../lib/adapters.js";
import { normalizeFromText } from "../lib/normalize.js";
import type { ServiceStatus } from "../lib/types.js";

export async function scrapeStatusPage(
  url: string,
  vendorId: string,
  selector?: string
): Promise<ServiceStatus> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "StatusPulse/1.0",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Scrape failed: ${resp.status}`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Try common status page patterns
  let statusText = "";

  if (selector) {
    statusText = $(selector).text().trim();
  } else {
    // Common Statuspage.io patterns
    const selectors = [
      ".page-status .status",
      ".unresolved-incident",
      '[class*="status"]',
      ".component-status",
      "[data-component-status]",
    ];

    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        statusText = el.text().trim();
        break;
      }
    }

    if (!statusText) {
      statusText = $("body").text().slice(0, 1000);
    }
  }

  return {
    vendorId,
    status: normalizeFromText(statusText),
    description: statusText.slice(0, 200),
    lastCheckedAt: new Date().toISOString(),
  };
}

/** Source adapter for HTML scraping. */
export const scrapeAdapter: SourceAdapter = {
  type: "scrape",
  async fetch(url, vendorId, config) {
    const selector = config?.selector as string | undefined;
    const status = await scrapeStatusPage(url, vendorId, selector);
    return { status };
  },
};

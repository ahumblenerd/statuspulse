import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";
import type { SourceAdapter } from "../lib/adapters.js";
import { normalizeFromText } from "../lib/normalize.js";
import { NormalizedStatus } from "../lib/types.js";
import type { ServiceStatus, Incident, NormalizedStatusType } from "../lib/types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchRssFeed(
  url: string,
  vendorId: string
): Promise<{
  status: ServiceStatus;
  incidents: Incident[];
}> {
  const resp = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`RSS fetch failed: ${resp.status} ${resp.statusText}`);
  }

  const xml = await resp.text();
  const parsed = parser.parse(xml);

  // Handle both RSS and Atom formats
  const items = extractItems(parsed);

  const incidents: Incident[] = items.slice(0, 10).map((item) => {
    const title = item.title ?? "Unknown";
    const description = item.description ?? item.summary ?? item.content ?? "";
    const link = item.link?.["@_href"] ?? item.link ?? "";
    const pubDate = item.pubDate ?? item.published ?? item.updated ?? new Date().toISOString();
    const externalId = item.guid ?? item.id ?? "";
    // Stable ID: hash of vendorId + guid/title + pubDate to survive feed reordering
    const hashInput = `${vendorId}:${externalId || title}:${pubDate}`;
    const stableId = `${vendorId}-rss-${createHash("sha256").update(hashInput).digest("hex").slice(0, 12)}`;

    return {
      id: stableId,
      vendorId,
      externalId: externalId || undefined,
      title: typeof title === "string" ? title : String(title),
      status: normalizeFromText(`${title} ${description}`),
      impact: "none",
      shortlink: typeof link === "string" ? link : undefined,
      createdAt: pubDate,
      updatedAt: pubDate,
      resolvedAt: undefined,
      updates: [
        {
          id: `${stableId}-0`,
          incidentId: stableId,
          status: "update",
          body: typeof description === "string" ? description.slice(0, 500) : "",
          createdAt: pubDate,
        },
      ],
    };
  });

  // Derive overall status from recent items
  const recentIncidents = incidents.filter((inc) => {
    const age = Date.now() - new Date(inc.createdAt).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24 hours
  });

  let overallStatus: NormalizedStatusType = NormalizedStatus.Operational;
  if (recentIncidents.some((i) => i.status === "outage")) {
    overallStatus = NormalizedStatus.Outage;
  } else if (recentIncidents.some((i) => i.status === "degraded")) {
    overallStatus = NormalizedStatus.Degraded;
  } else if (recentIncidents.some((i) => i.status === "maintenance")) {
    overallStatus = NormalizedStatus.Maintenance;
  }

  const status: ServiceStatus = {
    vendorId,
    status: overallStatus,
    description:
      overallStatus === NormalizedStatus.Operational
        ? "All systems operational"
        : `${recentIncidents.length} recent incident(s)`,
    lastCheckedAt: new Date().toISOString(),
  };

  return { status, incidents };
}

/** Source adapter for RSS/Atom feeds. */
export const rssAdapter: SourceAdapter = {
  type: "rss",
  fetch: (url, vendorId) => fetchRssFeed(url, vendorId),
};

/** Alias adapter for Atom feeds (same implementation). */
export const atomAdapter: SourceAdapter = {
  type: "atom",
  fetch: (url, vendorId) => fetchRssFeed(url, vendorId),
};

function extractItems(parsed: any): any[] {
  // RSS 2.0
  if (parsed.rss?.channel?.item) {
    const items = parsed.rss.channel.item;
    return Array.isArray(items) ? items : [items];
  }
  // Atom
  if (parsed.feed?.entry) {
    const entries = parsed.feed.entry;
    return Array.isArray(entries) ? entries : [entries];
  }
  return [];
}

import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { NormalizedStatusType } from "../lib/types.js";
import { getEnabledVendors } from "../vendors/registry.js";
import { toStatuspageResponse } from "./data.js";
import {
  applyScenario,
  getCurrentScenarioName,
  getCurrentStates,
  listScenarios,
  setVendorOverride,
} from "./scenarios.js";

export function createMockHandlers() {
  // Create handlers for all statuspage-api vendors
  const vendors = getEnabledVendors();

  const statuspageHandlers = vendors
    .filter((v) => v.ingestion.type === "statuspage-api")
    .map((vendor) =>
      http.get(vendor.ingestion.url, () => {
        const states = getCurrentStates();
        const state = states.find((s) => s.vendorId === vendor.id);
        if (!state) {
          // Return a generic operational response
          return HttpResponse.json({
            page: { id: vendor.id, name: vendor.name, url: vendor.statusPageUrl },
            status: { indicator: "none", description: "All Systems Operational" },
            components: [],
            incidents: [],
          });
        }
        return HttpResponse.json(toStatuspageResponse(state));
      })
    );

  // RSS handlers — generate feeds with incidents when vendor state is non-operational
  const rssHandlers = vendors
    .filter((v) => v.ingestion.type === "rss" || v.ingestion.type === "atom")
    .map((vendor) =>
      http.get(vendor.ingestion.url, () => {
        const states = getCurrentStates();
        const state = states.find((s) => s.vendorId === vendor.id);
        const items = state?.incidents?.length
          ? state.incidents
              .map(
                (inc) => `<item>
              <title>${inc.title}</title>
              <description>${inc.status === "outage" ? "Service disruption and unavailable" : inc.status === "degraded" ? "Degraded performance detected" : inc.title}</description>
              <pubDate>${new Date().toUTCString()}</pubDate>
              <guid>${inc.id}</guid>
            </item>`
              )
              .join("\n")
          : "";
        return new HttpResponse(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>${vendor.name}</title>${items}</channel></rss>`,
          { headers: { "Content-Type": "application/rss+xml" } }
        );
      })
    );

  // Catch-all for any unmatched statuspage URLs
  const catchAll = http.get(/\/api\/v2\/summary\.json$/, () => {
    return HttpResponse.json({
      page: { id: "unknown", name: "Unknown", url: "" },
      status: { indicator: "none", description: "All Systems Operational" },
      components: [],
      incidents: [],
    });
  });

  // Alert sinks (swallow alerts in mock mode)
  const alertSinks = [
    http.post(/hooks\.slack\.com/, () => HttpResponse.json({ ok: true })),
    http.post("*", ({ request }) => {
      // Only intercept if it looks like a webhook callback
      if (request.headers.get("User-Agent")?.includes("StatusPulse")) {
        return new HttpResponse(null, { status: 200 });
      }
      return undefined as unknown as Response; // passthrough
    }),
  ];

  return [...statuspageHandlers, ...rssHandlers, catchAll, ...alertSinks];
}

let _mockServer: ReturnType<typeof setupServer> | null = null;

export function startMockServer() {
  const handlers = createMockHandlers();
  _mockServer = setupServer(...handlers);
  _mockServer.listen({ onUnhandledRequest: "bypass" });
  console.log(`[mock] Mock mode active — all fetch() calls intercepted by MSW`);
  console.log(`[mock] Current scenario: ${getCurrentScenarioName()}`);
  console.log(
    `[mock] Available scenarios: ${listScenarios()
      .map((s) => s.id)
      .join(", ")}`
  );
  return _mockServer;
}

export function stopMockServer() {
  _mockServer?.close();
}

export const mockRoutes = new Hono();

mockRoutes.get("/scenarios", (c) => {
  return c.json({
    current: getCurrentScenarioName(),
    scenarios: listScenarios(),
  });
});

mockRoutes.post("/scenario/:name", (c) => {
  const name = c.req.param("name");
  try {
    const states = applyScenario(name);

    // Re-create handlers with new state
    if (_mockServer) {
      _mockServer.resetHandlers(...createMockHandlers());
    }

    return c.json({
      ok: true,
      scenario: name,
      summary:
        states
          .filter((s) => s.status !== "operational")
          .map((s) => `${s.name}: ${s.status}`)
          .join(", ") || "All operational",
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

mockRoutes.post("/vendor/:id/status", async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json<{ status: NormalizedStatusType }>();
  setVendorOverride(id, status);

  if (_mockServer) {
    _mockServer.resetHandlers(...createMockHandlers());
  }

  return c.json({ ok: true, vendorId: id, status });
});

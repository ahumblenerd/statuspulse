import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { webhookRoutes } from "../ingestion/webhook-receiver.js";
import { config } from "../lib/config.js";
import { initMockMode } from "../mock/mode.js";
import { authMiddleware } from "./middleware/auth.js";
import { alertTargetsRoutes } from "./routes/alert-targets.js";
import { boardAlertsRoutes } from "./routes/board-alerts.js";
import { boardMonitorsRoutes } from "./routes/board-monitors.js";
import { boardStatusRoutes } from "./routes/board-status.js";
import { boardsRoutes } from "./routes/boards.js";
import { historyRoutes } from "./routes/history.js";
import { incidentsRoutes } from "./routes/incidents.js";
import { mockBoardRoutes } from "./routes/mock.js";
import { pluginsRoutes } from "./routes/plugins.js";
import { publicStatusRoutes } from "./routes/public-status.js";
import { servicesRoutes } from "./routes/services.js";
import { statusRoutes } from "./routes/status.js";
import { uploadRoutes } from "./routes/upload.js";

export function createApp() {
  const app = new Hono();

  app.use("*", cors());
  app.use("*", logger());

  // Initialize mock mode if enabled (must be before routes)
  initMockMode(app);

  // Health check (no auth)
  app.get("/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

  // Public status API (no auth) — for the shareable status page
  app.route("/api/public", publicStatusRoutes);

  // Public board status (no auth)
  app.route("/api/boards", boardStatusRoutes);

  // API routes with auth
  const api = new Hono();
  api.use("*", authMiddleware);
  api.route("/services", servicesRoutes);
  api.route("/incidents", incidentsRoutes);
  api.route("/status", statusRoutes);
  api.route("/alert-targets", alertTargetsRoutes);
  api.route("/plugins", pluginsRoutes);
  api.route("/history", historyRoutes);
  api.route("/upload", uploadRoutes);
  api.route("/webhooks", webhookRoutes);
  api.route("/boards", boardsRoutes);
  api.route("/boards/:boardId/monitors", boardMonitorsRoutes);
  api.route("/boards/:boardId/alerts", boardAlertsRoutes);

  // Mock board routes — mock as product feature, always mounted
  api.route("/mock", mockBoardRoutes);

  app.route("/api", api);

  // OpenAPI spec (no auth)
  app.get("/api/openapi.json", async (c) => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const spec = readFileSync(join(process.cwd(), "openapi.json"), "utf-8");
    return c.json(JSON.parse(spec));
  });

  // Serve built frontend assets (Next.js static export)
  app.use("/_next/*", serveStatic({ root: "./dist-web" }));

  // Serve Next.js static export HTML for all non-API routes
  app.get("*", async (c) => {
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const pathname = new URL(c.req.url).pathname.replace(/\/$/, "") || "/index";
      const base = join(process.cwd(), "dist-web");
      // Try exact route HTML, then parent route, then index.html
      for (const candidate of [`${pathname}.html`, `${pathname}/index.html`, "index.html"]) {
        const file = join(base, candidate);
        if (existsSync(file)) return c.html(readFileSync(file, "utf-8"));
      }
      return c.text("StatusPulse is running. Visit /api/status for the API.");
    } catch {
      return c.text("StatusPulse is running. Visit /api/status for the API.");
    }
  });

  return app;
}

export function startApiServer() {
  const app = createApp();

  const server = serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
    console.log(`[api] HTTP server running on http://localhost:${info.port}`);
  });

  return server;
}

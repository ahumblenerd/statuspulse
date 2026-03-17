import type { Hono } from "hono";
import { startMockServer, mockRoutes } from "./server.js";

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

/**
 * Initialize mock mode: start MSW interceptor and register mock control routes.
 * Call this BEFORE any fetch() calls happen (before Restate poller starts).
 */
export function initMockMode(app: Hono): void {
  if (!isMockMode()) return;

  startMockServer();

  // Register mock control routes (no auth needed in mock mode)
  app.route("/api/mock", mockRoutes);

  console.log("[mock] Mock control API available at /api/mock/scenarios");
}

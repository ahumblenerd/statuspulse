import { timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";
import { config } from "../../lib/config.js";

/** Timing-safe string comparison to prevent timing attacks on API keys. */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (config.AUTH_MODE === "none") {
    return next();
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const apiKeyHeader = c.req.header("X-API-Key") ?? "";

  if (config.AUTH_MODE === "api-key") {
    if (
      safeCompare(apiKeyHeader, config.API_KEY) ||
      safeCompare(authHeader, `ApiKey ${config.API_KEY}`)
    ) {
      return next();
    }
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (config.AUTH_MODE === "bearer") {
    if (safeCompare(authHeader, `Bearer ${config.API_KEY}`)) {
      return next();
    }
    return c.json({ error: "Invalid bearer token" }, 401);
  }

  return next();
};

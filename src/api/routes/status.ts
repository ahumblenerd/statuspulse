import { Hono } from "hono";
import { getAggregateStatus } from "../helpers/status-aggregator.js";

export const statusRoutes = new Hono();

// Aggregate status overview
statusRoutes.get("/", async (c) => {
  const region = c.req.query("region");
  return c.json(getAggregateStatus(region));
});

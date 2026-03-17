import { z } from "zod";
import "dotenv/config";

const configSchema = z.object({
  DATABASE_PATH: z.string().default("./data/statuspulse.db"),
  DATABASE_URL: z.string().optional(),
  RESTATE_ADMIN_URL: z.string().default("http://localhost:9070"),
  RESTATE_INGRESS_URL: z.string().default("http://localhost:8080"),
  API_PORT: z.coerce.number().default(3001),
  MCP_PORT: z.coerce.number().default(3002),
  RESTATE_PORT: z.coerce.number().default(9080),
  AUTH_MODE: z.enum(["none", "api-key", "bearer"]).default("none"),
  API_KEY: z.string().default("changeme"),
  SLACK_WEBHOOK_URL: z.string().optional(),
  WEBHOOK_SECRET: z.string().default("statuspulse-secret"),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEFAULT_POLL_INTERVAL_SECONDS: z.coerce.number().default(120),
});

export const config = configSchema.parse(process.env);
export type Config = z.infer<typeof configSchema>;

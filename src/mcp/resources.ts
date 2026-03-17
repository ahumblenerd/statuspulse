import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { services, incidents } from "../db/schema.js";

export function registerResources(server: McpServer) {
  server.resource("services", "statuspulse://services", async () => {
    const rows = db.select().from(services).where(eq(services.enabled, true)).all();
    return {
      contents: [
        {
          uri: "statuspulse://services",
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  });

  server.resource("active-incidents", "statuspulse://incidents/active", async () => {
    const rows = db
      .select()
      .from(incidents)
      .all()
      .filter((i) => !i.resolvedAt);
    return {
      contents: [
        {
          uri: "statuspulse://incidents/active",
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  });
}

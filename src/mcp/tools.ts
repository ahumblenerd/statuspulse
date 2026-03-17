import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { services, incidents, components } from "../db/schema.js";
import { worstStatus } from "../lib/normalize.js";
import type { NormalizedStatusType } from "../lib/types.js";
import { searchVendors } from "../vendors/registry.js";
import { detectVendorsFromImage } from "../vision/detect.js";

export function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    operational: "\u{1F7E2}",
    degraded: "\u{1F7E1}",
    outage: "\u{1F534}",
    maintenance: "\u{1F527}",
  };
  return icons[status] ?? "\u2753";
}

export function registerTools(server: McpServer) {
  server.tool(
    "list_services",
    "List all monitored services and their current status. Filter by region or category.",
    {
      region: z.string().optional().describe("Filter by region"),
      category: z.string().optional().describe("Filter by category"),
    },
    async ({ region, category }) => {
      let rows = db.select().from(services).where(eq(services.enabled, true)).all();
      if (region) {
        rows = rows.filter((r) => r.region === region);
      }
      if (category) {
        rows = rows.filter((r) => r.category === category);
      }
      const text = rows
        .map((r) => `${statusIcon(r.status)} ${r.name} (${r.category}) [${r.region}]: ${r.status}`)
        .join("\n");
      return { content: [{ type: "text" as const, text: text || "No services found." }] };
    }
  );

  server.tool(
    "get_status",
    "Get the current status of a specific service by ID or name",
    { query: z.string().describe("Service ID or name to look up") },
    async ({ query }) => {
      const service = db
        .select()
        .from(services)
        .all()
        .find((s) => s.id === query || s.name.toLowerCase().includes(query.toLowerCase()));
      if (!service) {
        return { content: [{ type: "text" as const, text: `Service '${query}' not found.` }] };
      }
      const comps = db.select().from(components).where(eq(components.serviceId, service.id)).all();
      let text = `${statusIcon(service.status)} **${service.name}** (${service.category})\n`;
      text += `Status: ${service.status} | Region: ${service.region ?? "global"}\n`;
      text += `Description: ${service.description}\n`;
      if (comps.length > 0) {
        text += `\nComponents:\n`;
        for (const c of comps) {
          text += `  ${statusIcon(c.status)} ${c.name}: ${c.status}\n`;
        }
      }
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "get_incidents",
    "Get active incidents, optionally filtered by vendor or region",
    {
      vendor: z.string().optional().describe("Filter by vendor ID"),
      region: z.string().optional().describe("Filter by region"),
      includeResolved: z.boolean().optional().describe("Include resolved incidents"),
    },
    async ({ vendor, region, includeResolved }) => {
      let rows = db.select().from(incidents).orderBy(desc(incidents.updatedAt)).all();
      if (!includeResolved) {
        rows = rows.filter((r) => !r.resolvedAt);
      }
      if (vendor) {
        rows = rows.filter((r) => r.serviceId === vendor);
      }
      if (region) {
        rows = rows.filter((r) => r.region === region);
      }
      rows = rows.slice(0, 20);
      if (rows.length === 0) {
        return { content: [{ type: "text" as const, text: "No active incidents." }] };
      }
      const text = rows
        .map(
          (r) =>
            `${statusIcon(r.status)} [${r.serviceId}] ${r.title} (${r.status}) - ${r.updatedAt}`
        )
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "get_overview",
    "Get an overall status overview across all services, grouped by category and region",
    { region: z.string().optional().describe("Filter by region") },
    async ({ region }) => {
      let allSvcs = db.select().from(services).where(eq(services.enabled, true)).all();
      if (region) {
        allSvcs = allSvcs.filter((s) => s.region === region);
      }
      const activeInc = db
        .select()
        .from(incidents)
        .all()
        .filter((i) => !i.resolvedAt);
      const overall = worstStatus(allSvcs.map((s) => s.status as NormalizedStatusType));
      let text = `${statusIcon(overall)} **Overall: ${overall}**\n`;
      text += `${allSvcs.length} services, ${activeInc.length} active incidents\n\n`;
      const categories = [...new Set(allSvcs.map((s) => s.category))];
      for (const cat of categories) {
        const cs = allSvcs.filter((s) => s.category === cat);
        const st = worstStatus(cs.map((s) => s.status as NormalizedStatusType));
        text += `${statusIcon(st)} ${cat}: ${st} (${cs.length})\n`;
      }
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "search_vendor_catalog",
    "Search the vendor catalog for available services to monitor",
    { query: z.string().describe("Search query") },
    async ({ query }) => {
      const results = searchVendors(query);
      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No vendors matching '${query}'.` }] };
      }
      const text = results.map((v) => `- **${v.name}** (${v.id}) [${v.category}]`).join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "detect_vendors_from_image",
    "Analyze an image to detect SaaS vendors and their apparent status",
    {
      image: z.string().describe("Base64-encoded image data"),
      mediaType: z.string().optional().describe("Image media type"),
    },
    async ({ image, mediaType }) => {
      try {
        const result = await detectVendorsFromImage(image, mediaType ?? "image/png");
        const text = result.vendors
          .map(
            (v) =>
              `${statusIcon(v.apparentStatus)} ${v.name} → ${v.matchedVendorId ?? "?"} (${v.confidence})`
          )
          .join("\n");
        return { content: [{ type: "text" as const, text: text || "No vendors detected." }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { content: [{ type: "text" as const, text: `Detection failed: ${msg}` }] };
      }
    }
  );

  server.tool(
    "list_regions",
    "List all regions being tracked and their aggregate status",
    {},
    async () => {
      const allSvcs = db.select().from(services).where(eq(services.enabled, true)).all();
      const regions = [...new Set(allSvcs.map((s) => s.region ?? "global"))];
      const text = regions
        .map((r) => {
          const rs = allSvcs.filter((s) => (s.region ?? "global") === r);
          const st = worstStatus(rs.map((s) => s.status as NormalizedStatusType));
          return `${statusIcon(st)} **${r}**: ${st} (${rs.length} services)`;
        })
        .join("\n");
      return { content: [{ type: "text" as const, text: text || "No regions configured." }] };
    }
  );
}

import * as restate from "@restatedev/restate-sdk";
import { and, eq } from "drizzle-orm";
import { getDestAdapter } from "../alerts/registry.js";
import { db } from "../db/client.js";
import {
  getPreviousStatus,
  persistComponents,
  persistIncidents,
  persistProbeResult,
  persistStatus,
} from "../db/queries.js";
import { plugins } from "../db/schema.js";
import type { PluginConfig } from "../ingestion/plugin-runner.js";
import { probeEndpoint } from "../ingestion/probe.js";
import { getSourceAdapter } from "../ingestion/registry.js";
import { config } from "../lib/config.js";
import type { NormalizedStatusType, StatusChangeEvent } from "../lib/types.js";
import { getVendorById } from "../vendors/registry.js";
import { projectServiceUpdate } from "./projector.js";
import type { MonitorChangeEvent } from "./projector.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alerter = { name: "alerter" } as any;

export const poller = restate.object({
  name: "poller",
  handlers: {
    poll: async (ctx: restate.ObjectContext) => {
      const vendorId = ctx.key;
      const vendor = getVendorById(vendorId);

      if (!vendor) {
        await pollPlugin(ctx, vendorId);
        return;
      }

      try {
        const adapter = getSourceAdapter(vendor.ingestion.type);
        if (!adapter) {
          console.warn(`No source adapter for type: ${vendor.ingestion.type}`);
          return;
        }

        const result = await ctx.run("fetch", () => adapter.fetch(vendor.ingestion.url, vendorId));

        const prev = await ctx.run("get-prev-status", () => getPreviousStatus(vendorId));
        await ctx.run("persist", () =>
          persistStatus(vendorId, result.status, vendor.name, vendor.category, vendor.statusPageUrl)
        );
        if (result.status.components?.length) {
          await ctx.run("persist-components", () =>
            persistComponents(vendorId, result.status.components!)
          );
        }
        if (result.incidents?.length) {
          await ctx.run("persist-incidents", () => persistIncidents(vendorId, result.incidents!));
        }

        const probe = await ctx.run("probe", () => probeEndpoint(vendor.statusPageUrl));
        await ctx.run("probe-persist", () =>
          persistProbeResult(vendorId, vendor.statusPageUrl, probe)
        );

        if (prev && prev !== result.status.status) {
          const event: StatusChangeEvent = {
            vendorId,
            vendorName: vendor.name,
            previousStatus: prev as NormalizedStatusType,
            currentStatus: result.status.status,
            description: result.status.description,
            timestamp: new Date().toISOString(),
            region: "global",
            category: vendor.category,
          };
          ctx.serviceSendClient(alerter).alert(event);
        }

        // Project to board monitors and dispatch alerts
        const monitorChanges = await ctx.run("project", () =>
          projectServiceUpdate(vendorId, vendor.name)
        );
        for (const change of monitorChanges) {
          // Global alert (existing alertTargets table)
          ctx.serviceSendClient(alerter).alert(change.event);
          // Board-scoped alerts (delivered directly)
          await dispatchBoardAlerts(ctx, change);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Poll failed for ${vendorId}: ${msg}`);
      }

      const interval = vendor.pollIntervalSeconds ?? config.DEFAULT_POLL_INTERVAL_SECONDS;
      ctx.objectSendClient(poller, vendorId, { delay: interval * 1000 }).poll();
    },

    pollNow: async (ctx: restate.ObjectContext) => {
      ctx.objectSendClient(poller, ctx.key).poll();
      return { ok: true, vendorId: ctx.key };
    },
  },
});

async function pollPlugin(ctx: restate.ObjectContext, vendorId: string) {
  const pluginRows = await ctx.run("load-plugin", () =>
    db
      .select()
      .from(plugins)
      .where(and(eq(plugins.id, vendorId), eq(plugins.enabled, true)))
      .all()
  );
  if (pluginRows.length === 0) {
    console.warn(`Unknown vendor: ${vendorId}`);
    return;
  }

  const pluginConfig: PluginConfig = JSON.parse(pluginRows[0].config);
  const adapter = getSourceAdapter("custom-api");
  if (!adapter) {
    console.warn("No source adapter for custom-api");
    return;
  }

  try {
    const result = await ctx.run("plugin-fetch", () =>
      adapter.fetch(pluginConfig.url, vendorId, pluginConfig as unknown as Record<string, unknown>)
    );
    await ctx.run("plugin-persist", () => persistStatus(vendorId, result.status));

    // Project to board monitors (same as vendor poll)
    const changes = await ctx.run("plugin-project", () =>
      projectServiceUpdate(vendorId, pluginRows[0].name)
    );
    for (const change of changes) {
      ctx.serviceSendClient(alerter).alert(change.event);
      await dispatchBoardAlerts(ctx, change);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Plugin poll failed for ${vendorId}: ${msg}`);
  }

  ctx
    .objectSendClient(poller, vendorId, {
      delay: config.DEFAULT_POLL_INTERVAL_SECONDS * 1000,
    })
    .poll();
}

/** Dispatch alerts to board-scoped targets for a monitor change. */
async function dispatchBoardAlerts(ctx: restate.ObjectContext, change: MonitorChangeEvent) {
  for (const target of change.boardAlertTargets) {
    const adapter = getDestAdapter(target.type);
    if (!adapter) continue;
    try {
      await ctx.run(`board-${target.type}-${change.monitorId}`, () =>
        adapter.send({ url: target.url, secret: target.secret ?? undefined }, change.event)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poller] Board alert failed for ${target.type}: ${msg}`);
    }
  }
}

export type Poller = typeof poller;

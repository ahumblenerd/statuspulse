import * as restate from "@restatedev/restate-sdk";
import { eq } from "drizzle-orm";
import { getDestAdapter } from "../alerts/registry.js";
import { db } from "../db/client.js";
import { alertTargets } from "../db/schema.js";
import type { StatusChangeEvent } from "../lib/types.js";

export const alerter = restate.service({
  name: "alerter",
  handlers: {
    alert: async (ctx: restate.Context, event: StatusChangeEvent) => {
      console.log(
        `[alerter] Status change: ${event.vendorName} ${event.previousStatus} → ${event.currentStatus}`
      );

      const targets = await ctx.run("load-targets", () =>
        db.select().from(alertTargets).where(eq(alertTargets.enabled, true)).all()
      );

      for (const target of targets) {
        if (target.filterRegion && target.filterRegion !== "all" && event.region) {
          if (target.filterRegion !== event.region) continue;
        }
        if (target.filterCategory && target.filterCategory !== "all" && event.category) {
          if (target.filterCategory !== event.category) continue;
        }

        const adapter = getDestAdapter(target.type);
        if (!adapter) {
          console.warn(`No destination adapter for type: ${target.type}`);
          continue;
        }

        try {
          await ctx.run(`${target.type}-${target.id}`, () =>
            adapter.send({ url: target.url, secret: target.secret ?? undefined }, event)
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[alerter] Failed to send ${target.type} alert to ${target.name}: ${msg}`);
        }
      }
    },

    test: async (ctx: restate.Context, payload: { targetId: string }) => {
      const target = await ctx.run("load-target", () =>
        db.select().from(alertTargets).where(eq(alertTargets.id, payload.targetId)).get()
      );

      if (!target) {
        return { ok: false, error: "Target not found" };
      }

      const adapter = getDestAdapter(target.type);
      if (!adapter) {
        return { ok: false, error: `No adapter for type: ${target.type}` };
      }

      const testEvent: StatusChangeEvent = {
        vendorId: "test",
        vendorName: "StatusPulse Test",
        previousStatus: "operational",
        currentStatus: "degraded",
        description: "This is a test alert from StatusPulse",
        timestamp: new Date().toISOString(),
      };

      try {
        await ctx.run(`test-${target.type}`, () =>
          adapter.send({ url: target.url, secret: target.secret ?? undefined }, testEvent)
        );
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  },
});

export type Alerter = typeof alerter;

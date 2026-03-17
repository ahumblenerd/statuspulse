import * as restate from "@restatedev/restate-sdk";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { plugins } from "../db/schema.js";
import { getEnabledVendors } from "../vendors/registry.js";

export const scheduler = restate.workflow({
  name: "scheduler",
  handlers: {
    run: async (ctx: restate.WorkflowContext) => {
      console.log("[scheduler] Bootstrapping polling for all enabled vendors...");

      const vendors = getEnabledVendors();
      console.log(`[scheduler] Found ${vendors.length} enabled vendors`);

      // Start polling for each vendor with a small stagger
      for (let i = 0; i < vendors.length; i++) {
        const vendor = vendors[i];
        const delay = i * 2000; // 2s stagger between vendors

        ctx
          .objectSendClient({ name: "poller" } as any, vendor.id, {
            delay,
          })
          .poll();

        console.log(`[scheduler] Queued poll for ${vendor.name} (delay: ${delay}ms)`);
      }

      // Also start polling for plugin-based vendors
      const enabledPlugins = await ctx.run("load-plugins", () =>
        db.select().from(plugins).where(eq(plugins.enabled, true)).all()
      );

      for (let i = 0; i < enabledPlugins.length; i++) {
        const plugin = enabledPlugins[i];
        const delay = (vendors.length + i) * 2000;

        ctx
          .objectSendClient({ name: "poller" } as any, plugin.id, {
            delay,
          })
          .poll();

        console.log(`[scheduler] Queued plugin poll for ${plugin.name} (delay: ${delay}ms)`);
      }

      return {
        vendorsStarted: vendors.length,
        pluginsStarted: enabledPlugins.length,
      };
    },
  },
});

export type Scheduler = typeof scheduler;

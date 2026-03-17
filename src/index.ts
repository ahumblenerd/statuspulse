import * as restate from "@restatedev/restate-sdk";
import { startApiServer } from "./api/server.js";
import { initDb } from "./db/client.js";
import { seedDefaultBoard, syncDefaultBoardMonitors } from "./db/seed.js";
import { config } from "./lib/config.js";
import { startMcpHttp } from "./mcp/server.js";
import { alerter } from "./restate/alerter.js";
import { poller } from "./restate/poller.js";
import { warmProjectorCache } from "./restate/projector.js";
import { scheduler } from "./restate/scheduler.js";

async function main() {
  console.log("StatusPulse starting...");

  // Initialize database
  initDb(config.DATABASE_PATH);

  // Seed default board (first boot) or sync new services
  seedDefaultBoard();
  syncDefaultBoardMonitors();

  // Warm projector cache to prevent false alerts on restart
  warmProjectorCache();

  // 1. Start Hono HTTP API
  startApiServer();

  // 2. Start MCP HTTP server
  startMcpHttp();

  // 3. Start Restate endpoint
  const restateEndpoint = restate.endpoint();
  restateEndpoint.bind(poller);
  restateEndpoint.bind(alerter);
  restateEndpoint.bind(scheduler);

  const restateServer = restateEndpoint.listen(config.RESTATE_PORT);
  console.log(`[restate] Endpoint listening on port ${config.RESTATE_PORT}`);

  console.log(`
  ╔═══════════════════════════════════════╗
  ║         StatusPulse Running           ║
  ╠═══════════════════════════════════════╣
  ║  API:     http://localhost:${String(config.API_PORT).padEnd(5)}    ║
  ║  MCP:     http://localhost:${String(config.MCP_PORT).padEnd(5)}    ║
  ║  Restate: http://localhost:${String(config.RESTATE_PORT).padEnd(5)}    ║
  ╚═══════════════════════════════════════╝
  `);
}

main().catch(console.error);

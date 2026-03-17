import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "../lib/config.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

function createMcpServer() {
  const server = new McpServer({ name: "statuspulse", version: "1.0.0" });
  registerTools(server);
  registerResources(server);
  return server;
}

export async function startMcpStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startMcpHttp() {
  const server = createMcpServer();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if ((req.method === "POST" || req.method === "GET") && req.url === "/mcp") {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  httpServer.listen(config.MCP_PORT, () => {
    console.error(`[mcp] HTTP transport running on http://localhost:${config.MCP_PORT}/mcp`);
  });

  return httpServer;
}

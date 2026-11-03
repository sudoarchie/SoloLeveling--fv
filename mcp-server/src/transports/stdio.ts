import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createMcpServer } from "../server.js"

export async function runStdioServer() {
  const server = createMcpServer()
  const transport = new StdioServerTransport()

  // Diagnostic logs must go to stderr to prevent corrupting stdout JSON-RPC stream
  console.error("[GATE Tracker MCP] Starting in STDIO mode...")

  await server.connect(transport)
  console.error("[GATE Tracker MCP] Connected to STDIO transport. Ready for requests.")
}

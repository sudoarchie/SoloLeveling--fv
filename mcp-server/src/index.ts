#!/usr/bin/env node

import { runStdioServer } from "./transports/stdio.js"
import { runHttpServer } from "./transports/http.js"

function printHelp() {
  console.log(`
GATE Tracker Pro — Model Context Protocol (MCP) Server

Usage:
  gate-tracker-mcp [options]

Modes:
  --stdio             Run MCP server over standard input/output (default).
                      Compatible with Claude Desktop, Cursor, Antigravity, Cline, Windsurf.

  --http              Run MCP server with HTTP/SSE and REST endpoints.
                      Compatible with ChatGPT (MCP / SSE), ChatGPT Custom Actions, and web agents.

Options:
  -p, --port <number> Specify port for HTTP mode (default: 3001 or $PORT)
  -h, --help          Show this help message

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL             Supabase Project URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY Supabase Publishable Key
  GATE_TRACKER_EMAIL                   User email for authentication
  GATE_TRACKER_PASSWORD                User password for authentication
  SUPABASE_SERVICE_ROLE_KEY            (Optional) Admin bypass key
  GATE_TRACKER_USER_ID                 (Optional) Target User ID when using service role key
  PORT                                 HTTP port (default: 3001)

Examples:
  # Run in STDIO mode (for Claude Desktop / Cursor / Antigravity)
  node dist/index.js --stdio

  # Run in HTTP mode (for ChatGPT / SSE / Custom GPT Actions)
  node dist/index.js --http --port 3001
`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("-h") || args.includes("--help")) {
    printHelp()
    process.exit(0)
  }

  const isHttp = args.includes("--http") || args.includes("--sse") || process.env.MCP_MODE === "http"

  let port = 3001
  const portIdx = args.findIndex((arg) => arg === "-p" || arg === "--port")
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10)
  } else if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10)
  }

  if (isHttp) {
    await runHttpServer(port)
  } else {
    await runStdioServer()
  }
}

main().catch((err) => {
  console.error("[GATE Tracker MCP Fatal Error]:", err)
  process.exit(1)
})

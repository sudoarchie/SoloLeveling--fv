# GATE Tracker Pro — Model Context Protocol (MCP) Server

A high-performance Model Context Protocol (MCP) server that connects AI assistants (**ChatGPT**, **Claude Desktop**, **Cursor**, **Antigravity**, **LangChain**, **CrewAI**, or custom autonomous agents) directly to your **GATE Tracker Pro / Solo Leveling** study telemetry and preparation database.

---

## Capabilities & Available Data

The MCP server provides access to all your study performance metrics:

| Tool | Category | What it Provides |
|---|---|---|
| `get_performance_overview` | **Executive Brief** | High-level summary of Hunter rank, predicted marks, active streak, focus hours, revision health, and urgent advice. |
| `get_user_profile` | **Profile & Rank** | Current EXP, Hunter Rank (E to SSS), rank promotion requirements, target exam date, remaining days, plan status, unlocked titles & cosmetics, and custom mentor instructions. |
| `get_gate_marks_prediction` | **Mathematical Model** | GATE score prediction (0–100), score corridor, AIR band (e.g. AIR 1–50, AIR 300–1000), percentile, improvement velocity ($dM/dt$ marks/week), acceleration ($d^2M/dt^2$), exam-day projection, days to SSS rank, and plateau risk detection. |
| `get_study_streak` | **Consistency** | Active consecutive study streak, longest streak, dynamic streak derived from actual activity, streak freezes, and daily logging status. |
| `get_daily_reports` | **Daily Telemetry** | Daily focus/practice hours, lectures completed, topics revised, morning sessions, exercise, distraction levels (None/Low/Med/High), mental states, and aggregate averages. |
| `get_revision_topics` | **Spaced Repetition** | Weak topics tracked on the Ebbinghaus curve (stages 0–4). Lists overdue topics, topics due today for review, on-schedule topics, mastered topics, and difficulty ratings. |
| `get_mock_test_history` | **Exam Attempts** | Mock test attempts, marks obtained, percentage, accuracy %, questions attempted/correct/incorrect, time spent, platforms (Testbook, Made Easy, ACE), and notes. |
| `get_pomodoro_focus_sessions` | **Focus Stamina** | Focus blocks telemetry: presets, completion rate, pause frequency risk (flow state vs disruption), time-of-day lag windows, and user pause reasons. |
| `get_daily_quests` | **Quests** | Daily quests list, targets, progress, completion status, and rewards. |
| `get_ai_insights` | **AI Insights** | Daily AI mentor assessments: strengths, weaknesses, today's directive, and risk level. |
| `get_chat_history` | **Cross-Agent Memory** | Summaries and key exchanges from previous AI coaching sessions for continuous context. |
| `authenticate_user` | **Dynamic Auth** | Dynamic login tool allowing agents to authenticate on the fly using email and password if not configured in environment variables. |

---

## Architecture & Transports

The server supports dual transport modes:

1. **STDIO Mode** (Standard Input/Output)
   - Default mode.
   - For desktop apps and local agent runners: **Claude Desktop**, **Cursor**, **Antigravity**, **Cline**, **Windsurf**, CLI agents.
   - Zero HTTP latency; all diagnostic logs are isolated to `stderr` to ensure strict JSON-RPC standard compliance.

2. **HTTP / SSE Mode** (Server-Sent Events & REST)
   - Run with `--http --port 3001`.
   - Exposes:
     - `GET /sse` & `POST /messages`: MCP SSE transport for remote agents & ChatGPT MCP clients.
     - `GET /openapi.json`: OpenAPI 3.0 specification for **ChatGPT Custom GPT Actions**.
     - `GET /api/user/*`: Direct JSON REST endpoints for any web client or webhook.

---

## Quick Start

### 1. Build the server
```bash
cd mcp-server
pnpm install
pnpm build
```

### 2. Run Self-Test
Verify connectivity and data access:
```bash
pnpm test:tools
```

---

## Connecting to ChatGPT

You have two convenient ways to connect this server to ChatGPT:

### Option A: ChatGPT Custom GPT (Recommended & Easiest)
1. Start the MCP server in HTTP mode:
   ```bash
   pnpm --dir mcp-server start:http --port 3001
   ```
2. If ChatGPT is running in the cloud, expose port 3001 using a secure tunnel (e.g. `ngrok http 3001` or `cloudflared tunnel`).
3. Open ChatGPT -> **Explore GPTs** -> **Create a GPT** -> **Configure**.
4. Scroll to **Actions** -> Click **Create new action**.
5. Click **Import from URL** and enter:
   ```
   https://<your-tunnel-domain>/openapi.json
   ```
   *(Or click "Import from schema" and paste the JSON output from `http://localhost:3001/openapi.json`)*
6. ChatGPT will automatically recognize all endpoints (`getUserProfile`, `getPerformanceOverview`, `getGateMarksPrediction`, `getRevisionTopics`, etc.)!

### Option B: ChatGPT Desktop / MCP Client (SSE Transport)
Connect your ChatGPT MCP client directly to the SSE endpoint:
- **Server URL**: `http://localhost:3001/sse`
- **Transport**: `sse`

---

## Connecting to Claude Desktop

Edit `~/.config/Claude/claude_desktop_config.json` (Linux) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "gate-tracker": {
      "command": "node",
      "args": [
        "/home/archie/SoloLeveling--fv/.worktrees/mcp-server/mcp-server/dist/index.js",
        "--stdio"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "your-publishable-key",
        "GATE_TRACKER_EMAIL": "your_email@example.com",
        "GATE_TRACKER_PASSWORD": "your_password"
      }
    }
  }
}
```

---

## Connecting to Cursor / Windsurf

In Cursor settings (`Settings -> Features -> MCP`) or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gate-tracker": {
      "command": "node",
      "args": [
        "/home/archie/SoloLeveling--fv/.worktrees/mcp-server/mcp-server/dist/index.js",
        "--stdio"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "your-publishable-key",
        "GATE_TRACKER_EMAIL": "your_email@example.com",
        "GATE_TRACKER_PASSWORD": "your_password"
      }
    }
  }
}
```

---

## Connecting to Custom Agent Systems (LangChain, AutoGen, CrewAI, Python)

### Python (using `mcp` SDK)
```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    server_params = StdioServerParameters(
        command="node",
        args=["/home/archie/SoloLeveling--fv/.worktrees/mcp-server/mcp-server/dist/index.js", "--stdio"],
        env={
            "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "your-publishable-key",
            "GATE_TRACKER_EMAIL": "your_email@example.com",
            "GATE_TRACKER_PASSWORD": "your_password",
        }
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Call tool
            result = await session.call_tool("get_performance_overview", arguments={})
            print(result.content[0].text)

asyncio.run(main())
```

---

## Pre-built MCP Prompts & Resources

In addition to tools, the MCP server provides:

- **MCP Resources**:
  - `gate://user/profile`: Live profile & hunter rank
  - `gate://user/performance`: Executive performance summary
  - `gate://user/revision-topics`: Spaced repetition weak topics
  - `gate://user/mock-tests`: Test attempts history
  - `gate://user/daily-reports`: Last 14 days of study telemetry

- **MCP Prompts**:
  - `gate_coaching_briefing`: Ready-to-use high-performance cognitive coaching prompt with live telemetry injection.
  - `diagnose_weak_areas`: Diagnostic prompt focusing on overdue topics, forgetting curves, and interleaving revision.

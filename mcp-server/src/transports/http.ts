import express, { type Request, type Response } from "express"
import cors from "cors"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { createMcpServer } from "../server.js"
import { performanceService } from "../services/performance.js"
import { supabaseManager } from "../client/supabase.js"
import { generateOpenApiSpec } from "../openapi/spec.js"

export async function runHttpServer(port: number = 3001) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // Keep track of active SSE transports by sessionId
  const sseTransports = new Map<string, SSEServerTransport>()

  // ─── 1. MCP Server-Sent Events (SSE) Transport ─────────────────────────
  app.get("/sse", async (_req: Request, res: Response) => {
    console.error("[GATE Tracker MCP SSE] New SSE client connection initiated");
    const transport = new SSEServerTransport("/messages", res);
    sseTransports.set(transport.sessionId, transport);

    transport.onclose = () => {
      console.error(`[GATE Tracker MCP SSE] Session closed: ${transport.sessionId}`);
      sseTransports.delete(transport.sessionId);
    };

    const server = createMcpServer();
    await server.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send("Missing sessionId query parameter");
      return;
    }

    const transport = sseTransports.get(sessionId);
    if (!transport) {
      res.status(404).send(`Session ${sessionId} not found`);
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // ─── 2. OpenAPI Specification for ChatGPT Actions ───────────────────────
  app.get("/openapi.json", (req: Request, res: Response) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${port}`;
    const baseUrl = `${protocol}://${host}`;
    res.json(generateOpenApiSpec(baseUrl));
  });

  // ─── 3. Health & Status Check ───────────────────────────────────────────
  app.get(["/health", "/api/status"], async (_req: Request, res: Response) => {
    try {
      const user = await supabaseManager.ensureAuthenticated();
      res.json({
        status: "ok",
        mode: "mcp-http-and-rest",
        authenticated: true,
        userEmail: user.email,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.json({
        status: "ok",
        mode: "mcp-http-and-rest",
        authenticated: false,
        warning: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── 4. REST Endpoints for ChatGPT Actions / Direct Agents ───────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password required" });
        return;
      }
      const user = await supabaseManager.login(email, password);
      res.json({ success: true, email: user.email, userId: user.id });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  app.get("/api/user/profile", async (_req: Request, res: Response) => {
    try {
      const profile = await performanceService.getUserProfile();
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/performance", async (_req: Request, res: Response) => {
    try {
      const overview = await performanceService.getPerformanceOverview();
      res.json(overview);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/prediction", async (_req: Request, res: Response) => {
    try {
      const prediction = await performanceService.getGateMarksPrediction();
      res.json(prediction);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/streak", async (_req: Request, res: Response) => {
    try {
      const streak = await performanceService.getStudyStreak();
      res.json(streak);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/reports", async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 14;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const reports = await performanceService.getDailyReports(days, startDate, endDate);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/topics", async (req: Request, res: Response) => {
    try {
      const status = (req.query.status as any) || "all";
      const difficulty = (req.query.difficulty as any) || "all";
      const subject = req.query.subject as string | undefined;
      const topics = await performanceService.getRevisionTopics(status, difficulty, subject);
      res.json(topics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/mocks", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const examType = req.query.examType as any;
      const platform = req.query.platform as string | undefined;
      const mocks = await performanceService.getMockTestHistory(limit, examType, platform);
      res.json(mocks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/pomodoro", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as string | undefined;
      const pomodoro = await performanceService.getPomodoroFocusSessions(limit, status);
      res.json(pomodoro);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/quests", async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string | undefined;
      const quests = await performanceService.getDailyQuests(date);
      res.json(quests);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user/insights", async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string | undefined;
      const insights = await performanceService.getAiInsights(date);
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start HTTP Server
  const server = app.listen(port, () => {
    console.error(`[GATE Tracker MCP Server] Running on http://localhost:${port}`);
    console.error(`[GATE Tracker MCP Server] MCP SSE Endpoint: http://localhost:${port}/sse`);
    console.error(`[GATE Tracker MCP Server] ChatGPT OpenAPI Spec: http://localhost:${port}/openapi.json`);
    console.error(`[GATE Tracker MCP Server] REST API Base: http://localhost:${port}/api/user/...`);
  });

  return server;
}

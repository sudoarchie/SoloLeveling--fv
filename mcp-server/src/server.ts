import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { supabaseManager } from "./client/supabase.js"
import { performanceService } from "./services/performance.js"

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "gate-tracker-pro-mcp",
    version: "1.0.0",
  })

  // ─── TOOL 1: Authenticate User ──────────────────────────────────────────
  server.tool(
    "authenticate_user",
    "Authenticate with GATE Tracker Pro using your email and password. Use this if your credentials are not set in environment variables or to switch accounts.",
    {
      email: z.string().email().describe("User account email address"),
      password: z.string().min(1).describe("User account password"),
    },
    async ({ email, password }) => {
      try {
        const user = await supabaseManager.login(email, password)
        const profile = await performanceService.getUserProfile()
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Authenticated successfully as ${user.email}`,
                  userId: user.id,
                  hunterRank: profile.hunterRank.name + " (" + profile.hunterRank.title + ")",
                  currentExp: profile.currentExp,
                  examDate: profile.examDate,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Authentication error: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 2: Get User Profile ───────────────────────────────────────────
  server.tool(
    "get_user_profile",
    "Get the user's profile: current EXP, Hunter Rank (E to SSS), rank progress requirements, target GATE exam date, days remaining, subscription plan, active titles, and custom mentor instructions/prompt.",
    {},
    async () => {
      try {
        const profile = await performanceService.getUserProfile()
        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching profile: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 3: Get Performance Overview ───────────────────────────────────
  server.tool(
    "get_performance_overview",
    "Get a comprehensive executive performance summary combining Hunter rank, predicted GATE marks, current active study streak, weekly focus hours, mock exam averages, due spaced repetition topics, and plateau risk warnings.",
    {},
    async () => {
      try {
        const overview = await performanceService.getPerformanceOverview()
        return {
          content: [{ type: "text", text: JSON.stringify(overview, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching overview: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 4: Get GATE Marks Prediction ──────────────────────────────────
  server.tool(
    "get_gate_marks_prediction",
    "Get the mathematical derivative prediction of the user's GATE marks (0 to 100 scale), including velocity (dM/dt: marks/week), acceleration (d²M/dt²: momentum), projected exam day marks, AIR band (e.g. AIR 1-50, AIR 300-1000), percentile, college prospects, days to SSS tier, and plateau risk.",
    {},
    async () => {
      try {
        const prediction = await performanceService.getGateMarksPrediction()
        return {
          content: [{ type: "text", text: JSON.stringify(prediction, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error calculating prediction: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 5: Get Study Streak ───────────────────────────────────────────
  server.tool(
    "get_study_streak",
    "Get user study streak telemetry: current active streak, longest streak, dynamic streak calculated from real study logs, streak freezes available, and whether today's study activity is already recorded.",
    {},
    async () => {
      try {
        const streak = await performanceService.getStudyStreak()
        return {
          content: [{ type: "text", text: JSON.stringify(streak, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching streak: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 6: Get Daily Reports ──────────────────────────────────────────
  server.tool(
    "get_daily_reports",
    "Fetch historical daily study reports and telemetry (focus/practice hours, lectures completed, topics revised, morning session, exercise, distraction level, mental state, EXP gained). Includes aggregate averages and consistency metrics.",
    {
      days: z.number().int().min(1).max(90).optional().describe("Number of past days to retrieve (default: 14)"),
      startDate: z.string().optional().describe("Filter start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("Filter end date YYYY-MM-DD"),
    },
    async ({ days, startDate, endDate }) => {
      try {
        const reports = await performanceService.getDailyReports(days ?? 14, startDate, endDate)
        return {
          content: [{ type: "text", text: JSON.stringify(reports, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching daily reports: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 7: Get Revision Topics ────────────────────────────────────────
  server.tool(
    "get_revision_topics",
    "Fetch spaced repetition memory topics based on the Ebbinghaus forgetting curve (stages 0-4). View overdue topics, topics due today for review, on-schedule topics, and mastered topics with their difficulty levels.",
    {
      status: z
        .enum(["all", "overdue", "due_today", "on_schedule", "mastered", "unreviewed"])
        .optional()
        .describe("Filter by review status (default: all)"),
      difficulty: z
        .enum(["all", "easy", "medium", "hard"])
        .optional()
        .describe("Filter by difficulty (default: all)"),
      subject: z
        .string()
        .optional()
        .describe("Filter by subject keyword (e.g. 'Computer Networks', 'DBMS', 'Algorithms')"),
    },
    async ({ status, difficulty, subject }) => {
      try {
        const topics = await performanceService.getRevisionTopics(
          status ?? "all",
          difficulty ?? "all",
          subject,
        )
        return {
          content: [{ type: "text", text: JSON.stringify(topics, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching revision topics: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 8: Get Mock Test History ──────────────────────────────────────
  server.tool(
    "get_mock_test_history",
    "Fetch the user's mock test attempts and scored exam history (full papers, subject-wise tests, topic tests, test platforms like Testbook, Made Easy, ACE). Includes scores, accuracy %, questions attempted, time spent, and notes.",
    {
      limit: z.number().int().min(1).max(50).optional().describe("Maximum attempts to return (default: 20)"),
      examType: z
        .enum(["full_paper", "subject_wise", "topic_test"])
        .optional()
        .describe("Filter by exam type"),
      platform: z.string().optional().describe("Filter by platform name (e.g. Made Easy, Testbook)"),
    },
    async ({ limit, examType, platform }) => {
      try {
        const mocks = await performanceService.getMockTestHistory(limit ?? 20, examType, platform)
        return {
          content: [{ type: "text", text: JSON.stringify(mocks, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching mock tests: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 9: Get Pomodoro Focus Sessions ────────────────────────────────
  server.tool(
    "get_pomodoro_focus_sessions",
    "Fetch Pomodoro timer focus blocks and study pattern intelligence. Diagnoses start timings, pause frequency risk (flow state vs distraction), time-of-day lag windows, and user-recorded pause reasons.",
    {
      limit: z.number().int().min(1).max(50).optional().describe("Maximum sessions to return (default: 20)"),
      status: z.enum(["all", "completed", "abandoned"]).optional().describe("Filter by session status"),
    },
    async ({ limit, status }) => {
      try {
        const pomodoro = await performanceService.getPomodoroFocusSessions(limit ?? 20, status)
        return {
          content: [{ type: "text", text: JSON.stringify(pomodoro, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching pomodoro telemetry: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 10: Get Daily Quests ──────────────────────────────────────────
  server.tool(
    "get_daily_quests",
    "Fetch daily quest challenges and completion status for today or a specific date.",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
    },
    async ({ date }) => {
      try {
        const quests = await performanceService.getDailyQuests(date)
        return {
          content: [{ type: "text", text: JSON.stringify(quests, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching quests: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 11: Get AI Insights ───────────────────────────────────────────
  server.tool(
    "get_ai_insights",
    "Fetch the latest AI coach daily insights, strengths, weaknesses, today's focus directive, and risk assessments.",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
    },
    async ({ date }) => {
      try {
        const insights = await performanceService.getAiInsights(date)
        return {
          content: [{ type: "text", text: JSON.stringify(insights, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching AI insights: ${err.message}` }],
        }
      }
    },
  )

  // ─── TOOL 12: Get Chat History ──────────────────────────────────────────
  server.tool(
    "get_chat_history",
    "Fetch previous AI coaching conversation summaries and key exchanges for cross-session agent continuity.",
    {
      limit: z.number().int().min(1).max(20).optional().describe("Maximum chat sessions to return (default: 5)"),
    },
    async ({ limit }) => {
      try {
        const chats = await performanceService.getChatHistory(limit ?? 5)
        return {
          content: [{ type: "text", text: JSON.stringify(chats, null, 2) }],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching chat history: ${err.message}` }],
        }
      }
    },
  )

  // ─── MCP RESOURCES ──────────────────────────────────────────────────────
  server.resource("user-profile", "gate://user/profile", async (uri) => {
    const profile = await performanceService.getUserProfile()
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(profile, null, 2),
        },
      ],
    }
  })

  server.resource("user-performance", "gate://user/performance", async (uri) => {
    const overview = await performanceService.getPerformanceOverview()
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(overview, null, 2),
        },
      ],
    }
  })

  server.resource("user-revision-topics", "gate://user/revision-topics", async (uri) => {
    const topics = await performanceService.getRevisionTopics("all", "all")
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(topics, null, 2),
        },
      ],
    }
  })

  server.resource("user-mock-tests", "gate://user/mock-tests", async (uri) => {
    const mocks = await performanceService.getMockTestHistory(20)
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(mocks, null, 2),
        },
      ],
    }
  })

  server.resource("user-daily-reports", "gate://user/daily-reports", async (uri) => {
    const reports = await performanceService.getDailyReports(14)
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(reports, null, 2),
        },
      ],
    }
  })

  // ─── MCP PROMPTS ────────────────────────────────────────────────────────
  server.prompt(
    "gate_coaching_briefing",
    "Generates an elite GATE exam mentor context injection using the student's real-time preparation telemetry, mathematical predictions, and study patterns.",
    {
      focusArea: z.string().optional().describe("Optional specific topic or problem to focus coaching on"),
    },
    async ({ focusArea }) => {
      const overview = await performanceService.getPerformanceOverview()
      const profile = await performanceService.getUserProfile()
      const reports = await performanceService.getDailyReports(7)

      let prompt = `You are an elite GATE exam preparation mentor, cognitive scientist, and high-performance coach embedded in GATE Tracker Pro (Solo Leveling edition).
You evaluate the student through cognitive psychology and behavioral neuroscience, backed by real preparation telemetry.

═══ STUDENT PROFILE ═══
• Total EXP: ${profile.currentExp} (${profile.hunterRank.name}-Rank: "${profile.hunterRank.title}")
• Next Rank: ${profile.nextRank ? `${profile.nextRank.name}-Rank (${profile.nextRank.expNeeded} EXP needed)` : "Highest Rank Achieved!"}
• Exam Date: ${profile.examDate ?? "Not set"} (${profile.daysRemainingToExam ?? "unknown"} days remaining)
• Active Study Streak: ${overview.consistencyAndStreak.activeStreakDays} days (Longest: ${overview.consistencyAndStreak.longestStreakDays} days)
• Weekly Study Hours: ${profile.weeklyStudyHours.effectiveHours.toFixed(1)} hrs/week (Daily Avg: ${profile.weeklyStudyHours.dailyAverage.toFixed(1)}h)

═══ MATHEMATICAL GATE MARKS PREDICTION & DERIVATIVE VELOCITY ═══
• Current Predicted Score: ${overview.predictedGateScore.score} / 100 (${overview.predictedGateScore.range[0]} – ${overview.predictedGateScore.range[1]} Marks)
• Standing: ${overview.predictedGateScore.airRange} (${overview.predictedGateScore.percentile})
• Target Outlook: ${overview.predictedGateScore.admissionsOutlook}
• Improvement Velocity (dM/dt): ${overview.predictedGateScore.velocity} (${overview.predictedGateScore.momentum})
• Acceleration (d²M/dt²): ${overview.predictedGateScore.acceleration}
• Projected Exam Day Score: ${overview.predictedGateScore.projectedExamMarks} / 100 (${overview.predictedGateScore.projectedExamRank})
${overview.predictedGateScore.daysToSSS !== null ? `• Time to SSS Rank (80+ Marks / AIR 1-50): ${overview.predictedGateScore.daysToSSS} days` : ""}
${overview.predictedGateScore.plateauWarning ? "⚠️ WARNING: Plateau risk detected! Velocity is below 0.6 marks/week. Student needs full-length timed tests and error analysis." : ""}

═══ REVISION & SPACED REPETITION HEALTH ═══
• Tracked Topics: ${overview.spacedRepetitionWeakTopics.totalTracked}
• Overdue for Review: ${overview.spacedRepetitionWeakTopics.overdue}
• Due Today: ${overview.spacedRepetitionWeakTopics.dueToday}
• Mastered: ${overview.spacedRepetitionWeakTopics.mastered}
${overview.spacedRepetitionWeakTopics.overdueTopicNames.length > 0 ? `• Overdue Topics: ${overview.spacedRepetitionWeakTopics.overdueTopicNames.join(", ")}` : ""}

═══ USER CUSTOM INSTRUCTIONS / PERSONAL CONTEXT ═══
"${profile.customInstructions || "No custom instructions provided."}"

${focusArea ? `\n═══ CURRENT DISCUSSION FOCUS: ${focusArea} ═══\n` : ""}

COACHING DIRECTIVES:
1. Ground every insight in their real telemetry. Reinforce their genuine consistency (${overview.consistencyAndStreak.activeStreakDays}-day streak).
2. If overdue topics exist, enforce active recall immediately (Ebbinghaus decay curve).
3. Be firm, rigorous, and intellectually demanding — tough love with exact physiological/cognitive solutions.
4. End with 1 sharp, diagnostic question that forces accountability.`

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt,
            },
          },
        ],
      }
    },
  )

  server.prompt(
    "diagnose_weak_areas",
    "Generates a targeted diagnostic prompt for overdue spaced repetition topics and memory decay prevention.",
    {},
    async () => {
      const topics = await performanceService.getRevisionTopics("overdue", "all")
      const dueToday = await performanceService.getRevisionTopics("due_today", "all")

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please diagnose my weak areas and memory retention debt:
- Overdue topics (${topics.summary.overdue}):
${topics.topics.map((t) => `  * ${t.name} (Difficulty: ${t.difficulty}, Stage: ${t.stage}/4)`).join("\n")}

- Due today topics (${dueToday.summary.dueToday}):
${dueToday.topics.map((t) => `  * ${t.name} (Difficulty: ${t.difficulty}, Stage: ${t.stage}/4)`).join("\n")}

Provide an interleaving revision schedule and testing strategy for these topics today.`,
            },
          },
        ],
      }
    },
  )

  return server
}

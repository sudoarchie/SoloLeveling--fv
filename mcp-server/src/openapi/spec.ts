export function generateOpenApiSpec(baseUrl: string = "http://localhost:3001") {
  return {
    openapi: "3.1.0",
    info: {
      title: "GATE Tracker Pro & Solo Leveling Telemetry API",
      description:
        "API for reading user study performance, Hunter rank, GATE marks derivative predictions, daily reports, and revision topics from GATE Tracker Pro.",
      version: "1.0.0",
    },
    servers: [
      {
        url: baseUrl,
        description: "GATE Tracker MCP & REST Server",
      },
    ],
    paths: {
      "/api/user/profile": {
        get: {
          operationId: "getUserProfile",
          summary: "Get User Profile & Hunter Rank",
          description:
            "Returns user info, Hunter rank (E to SSS), EXP, weekly study hours, target exam date, and custom instructions.",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/performance": {
        get: {
          operationId: "getPerformanceOverview",
          summary: "Get Performance Overview",
          description:
            "Returns executive summary of rank, predicted GATE marks, current streak, focus hours, and revision health.",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/prediction": {
        get: {
          operationId: "getGateMarksPrediction",
          summary: "Get GATE Marks Derivative Prediction",
          description:
            "Returns predicted marks (0-100), velocity dM/dt, acceleration, AIR rank band, and projected exam day score.",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/streak": {
        get: {
          operationId: "getStudyStreak",
          summary: "Get Study Streak",
          description: "Returns active streak, longest streak, streak freezes, and study consistency.",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/reports": {
        get: {
          operationId: "getDailyReports",
          summary: "Get Daily Study Reports",
          description:
            "Returns daily practice hours, lectures completed, topics revised, distraction level, and mental states.",
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 14 },
              description: "Number of past days to retrieve",
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/topics": {
        get: {
          operationId: "getRevisionTopics",
          summary: "Get Spaced Repetition Weak Topics",
          description:
            "Returns topics tracked for spaced repetition, overdue reviews, topics due today, and mastery status.",
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["all", "overdue", "due_today", "on_schedule", "mastered", "unreviewed"],
                default: "all",
              },
              description: "Filter by status",
            },
            {
              name: "difficulty",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["all", "easy", "medium", "hard"],
                default: "all",
              },
              description: "Filter by difficulty",
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/mocks": {
        get: {
          operationId: "getMockTestHistory",
          summary: "Get Mock Test History",
          description: "Returns mock exams taken, marks obtained, percentage, accuracy, and platform.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
              description: "Number of attempts to return",
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/user/pomodoro": {
        get: {
          operationId: "getPomodoroFocusSessions",
          summary: "Get Pomodoro Focus Telemetry",
          description: "Returns Pomodoro timer focus blocks, pause frequency risk, and study pattern analysis.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  }
}

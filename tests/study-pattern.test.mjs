import test from "node:test"
import assert from "node:assert/strict"
import { analyzeStudyPatterns, formatStudyPatternForPrompt } from "../lib/study-pattern.ts"

test("study pattern analysis computes start timings, pause counts, and excessive pause risk", () => {
  const mockSessions = [
    {
      id: "s1",
      started_at: "2026-10-25T21:30:00.000Z", // 9:30 PM (Night)
      ended_at: "2026-10-25T23:00:00.000Z",
      duration_minutes: 90,
      pause_count: 4,
      total_paused_seconds: 600, // 10 mins
      status: "completed",
      events: [
        { type: "start", timestamp: "2026-10-25T21:30:00.000Z", timeLeft: 5400 },
        { type: "pause", timestamp: "2026-10-25T21:38:00.000Z", timeLeft: 4920, elapsedSeconds: 480 }, // early pause (8 mins in)
        { type: "resume", timestamp: "2026-10-25T21:40:00.000Z", pauseDurationSeconds: 120 },
        { type: "pause", timestamp: "2026-10-25T21:44:00.000Z", timeLeft: 4680, elapsedSeconds: 720 }, // early pause (12 mins in)
        { type: "resume", timestamp: "2026-10-25T21:47:00.000Z", pauseDurationSeconds: 180 },
        { type: "pause", timestamp: "2026-10-25T22:15:00.000Z", timeLeft: 3000, elapsedSeconds: 2400 },
        { type: "resume", timestamp: "2026-10-25T22:18:00.000Z", pauseDurationSeconds: 180 },
        { type: "pause", timestamp: "2026-10-25T22:45:00.000Z", timeLeft: 1200, elapsedSeconds: 4200 },
        { type: "resume", timestamp: "2026-10-25T22:47:00.000Z", pauseDurationSeconds: 120 },
        { type: "complete", timestamp: "2026-10-25T23:00:00.000Z" },
      ],
    },
    {
      id: "s2",
      started_at: "2026-10-24T22:00:00.000Z", // 10:00 PM (Night)
      ended_at: "2026-10-24T22:45:00.000Z",
      duration_minutes: 45,
      pause_count: 3,
      total_paused_seconds: 300,
      status: "completed",
      events: [
        { type: "start", timestamp: "2026-10-24T22:00:00.000Z" },
        { type: "pause", timestamp: "2026-10-24T22:10:00.000Z", elapsedSeconds: 600 }, // early pause (10 mins in)
        { type: "resume", timestamp: "2026-10-24T22:12:00.000Z" },
        { type: "complete", timestamp: "2026-10-24T22:45:00.000Z" },
      ],
    },
  ]

  const activePomodoro = {
    status: "paused",
    startedAt: "2026-10-25T23:15:00.000Z",
    pauseCount: 2,
    totalPausedSeconds: 180,
    lastPausedAt: "2026-10-25T23:25:00.000Z",
  }

  const analysis = analyzeStudyPatterns(mockSessions, activePomodoro)

  assert.equal(analysis.totalSessions, 2)
  assert.equal(analysis.completedSessions, 2)
  assert.equal(analysis.pausePatterns.totalPauses, 7)
  assert.equal(analysis.pausePatterns.avgPausesPerSession, 3.5)
  // 3.5 pauses per session is >= 3.0 -> HIGH pause frequency risk!
  assert.equal(analysis.pausePatterns.pauseFrequencyRisk, "HIGH")
  assert.ok(analysis.pausePatterns.pauseFrequencyDescription.includes("Too Many Pauses Detected"))

  // Check early pause detection (3 early pauses)
  assert.equal(analysis.pausePatterns.timingOfPauses.earlyPausesCount, 3)
  assert.ok(analysis.pausePatterns.timingOfPauses.diagnosticNote.includes("Startup Friction Detected"))

  // Check start timing breakdown
  assert.ok(analysis.startTimings.primaryWindow.includes("Night"))

  // Check active session analysis
  assert.ok(analysis.activeSessionAnalysis)
  assert.equal(analysis.activeSessionAnalysis.status, "paused")
  assert.equal(analysis.activeSessionAnalysis.pausesSoFar, 2)

  // Check AI prompt formatting
  const promptOutput = formatStudyPatternForPrompt(analysis)
  assert.ok(promptOutput.includes("STUDY PATTERN & TIMER TELEMETRY"))
  assert.ok(promptOutput.includes("Average Pauses per Session: 3.5"))
  assert.ok(promptOutput.includes("PAUSE FREQUENCY DIAGNOSIS"))
  assert.ok(promptOutput.includes("Startup Friction Detected"))
})

test("study pattern analysis identifies unbroken deep work and morning study routine", () => {
  const morningFlowSessions = [
    {
      id: "m1",
      started_at: "2026-10-25T08:30:00.000Z",
      ended_at: "2026-10-25T10:00:00.000Z",
      duration_minutes: 90,
      pause_count: 0,
      total_paused_seconds: 0,
      status: "completed",
      events: [
        { type: "start", timestamp: "2026-10-25T08:30:00.000Z" },
        { type: "complete", timestamp: "2026-10-25T10:00:00.000Z" },
      ],
    },
    {
      id: "m2",
      started_at: "2026-10-24T09:00:00.000Z",
      ended_at: "2026-10-24T10:30:00.000Z",
      duration_minutes: 90,
      pause_count: 0,
      total_paused_seconds: 0,
      status: "completed",
      events: [
        { type: "start", timestamp: "2026-10-24T09:00:00.000Z" },
        { type: "complete", timestamp: "2026-10-24T10:30:00.000Z" },
      ],
    },
  ]

  const analysis = analyzeStudyPatterns(morningFlowSessions)
  assert.equal(analysis.pausePatterns.totalPauses, 0)
  assert.equal(analysis.pausePatterns.avgPausesPerSession, 0)
  assert.equal(analysis.pausePatterns.pauseFrequencyRisk, "LOW")
  assert.ok(analysis.pausePatterns.pauseFrequencyDescription.includes("High Continuous Focus"))
})

test("study pattern handles empty session histories gracefully", () => {
  const analysis = analyzeStudyPatterns([])
  assert.equal(analysis.totalSessions, 0)
  assert.equal(analysis.pausePatterns.totalPauses, 0)
  const promptOutput = formatStudyPatternForPrompt(analysis)
  assert.ok(promptOutput.includes("No historical timer sessions logged yet"))
})

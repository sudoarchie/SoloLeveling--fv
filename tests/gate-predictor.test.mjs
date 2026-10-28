import test from "node:test"
import assert from "node:assert/strict"
import { RANKS, predictBaseGateScore, getRankGateMarks } from "../lib/ranks.ts"
import {
  calculateGateMarksPrediction,
  GATE_RANK_THRESHOLDS,
  getRankFromGateScore,
} from "../lib/gate-predictor.ts"

test("GATE Marks hierarchy accurately maps SSS Rank to 80-100 marks and lower ranks accordingly", () => {
  // SSS Rank must be 80 - 100 marks
  const sss = GATE_RANK_THRESHOLDS["SSS"]
  assert.equal(sss.minMarks, 80, "SSS Rank minMarks must be 80")
  assert.equal(sss.maxMarks, 100, "SSS Rank maxMarks must be 100")
  assert.match(sss.airRange, /AIR 1/i)

  // SS Rank: 70 - 80 marks
  const ss = GATE_RANK_THRESHOLDS["SS"]
  assert.equal(ss.minMarks, 70)
  assert.equal(ss.maxMarks, 80)

  // S Rank: 60 - 70 marks
  const s = GATE_RANK_THRESHOLDS["S"]
  assert.equal(s.minMarks, 60)
  assert.equal(s.maxMarks, 70)

  // A Rank: 50 - 60 marks
  const a = GATE_RANK_THRESHOLDS["A"]
  assert.equal(a.minMarks, 50)
  assert.equal(a.maxMarks, 60)

  // B Rank: 40 - 50 marks
  const b = GATE_RANK_THRESHOLDS["B"]
  assert.equal(b.minMarks, 40)
  assert.equal(b.maxMarks, 50)

  // C Rank: 32 - 40 marks (Qualifying cutoff margin)
  const c = GATE_RANK_THRESHOLDS["C"]
  assert.equal(c.minMarks, 32)
  assert.equal(c.maxMarks, 40)

  // D Rank: 25 - 32 marks (Cutoff threshold)
  const d = GATE_RANK_THRESHOLDS["D"]
  assert.equal(d.minMarks, 25)
  assert.equal(d.maxMarks, 32)

  // E Rank: 0 - 25 marks (Below cutoff)
  const e = GATE_RANK_THRESHOLDS["E"]
  assert.equal(e.minMarks, 0)
  assert.equal(e.maxMarks, 25)
})

test("getRankFromGateScore maps marks correctly across all intervals", () => {
  assert.equal(getRankFromGateScore(85).name, "SSS")
  assert.equal(getRankFromGateScore(80).name, "SSS")
  assert.equal(getRankFromGateScore(76.5).name, "SS")
  assert.equal(getRankFromGateScore(70).name, "SS")
  assert.equal(getRankFromGateScore(65).name, "S")
  assert.equal(getRankFromGateScore(54).name, "A")
  assert.equal(getRankFromGateScore(44).name, "B")
  assert.equal(getRankFromGateScore(35).name, "C")
  assert.equal(getRankFromGateScore(28).name, "D")
  assert.equal(getRankFromGateScore(15).name, "E")
})

test("calculateGateMarksPrediction computes realistic score, velocity (dM/dt), and projected exam score", () => {
  const result = calculateGateMarksPrediction({
    currentExp: 18000, // SSS rank EXP
    weeklyStudyStats: {
      rolling7DaysHours: 85,
      calendarWeekHours: 85,
      dailyAvgHours: 12,
      effectiveWeeklyHours: 85,
      activeDays7: 7,
    },
    mockAttempts: [
      { marksObtained: 82, totalMarks: 100, scorePct: 82, attemptedAt: new Date(Date.now() - 7 * 86400000) },
      { marksObtained: 86, totalMarks: 100, scorePct: 86, attemptedAt: new Date() },
    ],
    examDate: new Date(Date.now() + 45 * 86400000), // 45 days away
  })

  // SSS score verification
  assert.ok(result.currentMarks >= 80, `Expected SSS score >= 80, got ${result.currentMarks}`)
  assert.ok(result.currentMarks <= 100, `Expected SSS score <= 100, got ${result.currentMarks}`)
  assert.equal(result.currentRank.name, "SSS")

  // Derivative verification: velocity dM/dt must be positive
  assert.ok(result.velocity > 0, `Improvement velocity should be positive, got ${result.velocity}`)
  assert.ok(result.projectedExamMarks >= result.currentMarks, "Projected exam marks should not drop below current marks for active student")
  assert.equal(result.daysToSSS, 0, "Student at >=80 marks has 0 daysToSSS")
  assert.ok(result.chartData.length >= 10, "Chart data should contain both historical and projected points")
})

test("Student at lower rank projects accurate days to SSS based on velocity", () => {
  const result = calculateGateMarksPrediction({
    currentExp: 4000, // B-Rank
    weeklyStudyStats: {
      rolling7DaysHours: 35,
      calendarWeekHours: 35,
      dailyAvgHours: 5,
      effectiveWeeklyHours: 35,
      activeDays7: 6,
    },
    examDate: new Date(Date.now() + 100 * 86400000),
  })

  assert.ok(result.currentMarks >= 40 && result.currentMarks <= 55, `Expected B-Rank range 40-55, got ${result.currentMarks}`)
  assert.ok(result.velocity > 0, "Velocity should be positive")
  assert.ok(result.daysToSSS !== null && result.daysToSSS > 0, `Expected positive daysToSSS, got ${result.daysToSSS}`)
})

test("AI Mentor prompt builder incorporates pause description and pause activity logs", async () => {
  const { buildChatPrompt } = await import("../lib/ai-prompt.ts")

  const dummyCtx = {
    progress: { current_exp: 10000, exam_date: "2027-02-01" },
    reports: [],
    attempts: [],
    topics: [],
    streak: { current_streak: 5 },
  }

  const promptMessages = buildChatPrompt(dummyCtx, null, [{ role: "user", content: "How was my pause?" }], {
    status: "paused",
    durationMinutes: 90,
    description: "Operating Systems Virtual Memory",
    pauseCount: 2,
    totalPausedSeconds: 300,
    currentPauseDescription: "Drank water and did 5-minute eye relaxation",
    pauseActivities: [
      { timestamp: new Date().toISOString(), durationSeconds: 180, description: "Hydration break" },
      { timestamp: new Date().toISOString(), durationSeconds: 120, description: "Drank water and did 5-minute eye relaxation" },
    ],
  })

  const systemContent = promptMessages.find((m) => m.role === "system")?.content || ""
  assert.ok(
    systemContent.includes("ACTIVE/LATEST PAUSE ACTIVITY: \"Drank water and did 5-minute eye relaxation\""),
    "System prompt must contain the current pause description",
  )
  assert.ok(
    systemContent.includes("Hydration break"),
    "System prompt must contain logged pause activities",
  )
  assert.ok(
    systemContent.includes("GATE MARKS PREDICTOR & DERIVATIVE VELOCITY"),
    "System prompt must contain GATE Marks Predictor & derivative velocity data",
  )
})

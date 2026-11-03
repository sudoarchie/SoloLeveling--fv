import { performanceService } from "../src/services/performance.js"
import { supabaseManager } from "../src/client/supabase.js"
import { createMcpServer } from "../src/server.js"

async function runTests() {
  console.log("=== GATE Tracker MCP Server Self-Test ===")

  // 1. Test Auth
  console.log("\n1. Testing Authentication...")
  const user = await supabaseManager.ensureAuthenticated()
  console.log(`✓ Authenticated as: ${user.email} (ID: ${user.id})`)

  // 2. Test User Profile
  console.log("\n2. Testing getUserProfile()...")
  const profile = await performanceService.getUserProfile()
  console.log(`✓ Hunter Rank: ${profile.hunterRank.name} (${profile.hunterRank.title})`)
  console.log(`✓ EXP: ${profile.currentExp}, Plan: ${profile.plan}`)
  console.log(`✓ Target Exam Date: ${profile.examDate} (${profile.daysRemainingToExam} days left)`)
  console.log(`✓ Weekly Study Hours: ${profile.weeklyStudyHours.effectiveHours} hrs/wk`)

  // 3. Test Performance Overview
  console.log("\n3. Testing getPerformanceOverview()...")
  const overview = await performanceService.getPerformanceOverview()
  console.log(`✓ Predicted Marks: ${overview.predictedGateScore.score}/100 (Range: ${overview.predictedGateScore.range.join(" - ")})`)
  console.log(`✓ Standing: ${overview.predictedGateScore.airRange} (${overview.predictedGateScore.percentile})`)
  console.log(`✓ Velocity: ${overview.predictedGateScore.velocity} (${overview.predictedGateScore.momentum})`)
  console.log(`✓ Active Streak: ${overview.consistencyAndStreak.activeStreakDays} days`)
  console.log(`✓ Spaced Repetition Due: ${overview.spacedRepetitionWeakTopics.dueToday} today, ${overview.spacedRepetitionWeakTopics.overdue} overdue`)

  // 4. Test GATE Marks Prediction
  console.log("\n4. Testing getGateMarksPrediction()...")
  const prediction = await performanceService.getGateMarksPrediction()
  console.log(`✓ Current Marks: ${prediction.currentMarks}`)
  console.log(`✓ Projected Exam Marks: ${prediction.projectedExamMarks} (${prediction.projectedRank.name}-Rank)`)
  console.log(`✓ Days to SSS Rank: ${prediction.daysToSSS}`)
  console.log(`✓ Plateau Warning: ${prediction.plateauRisk}`)

  // 5. Test Study Streak
  console.log("\n5. Testing getStudyStreak()...")
  const streak = await performanceService.getStudyStreak()
  console.log(`✓ Current Streak: ${streak.currentStreak}, Longest: ${streak.longestStreak}`)
  console.log(`✓ Active Days Tracked: ${streak.totalActiveStudyDays}/${streak.totalEntriesTracked}`)

  // 6. Test Daily Reports
  console.log("\n6. Testing getDailyReports(7)...")
  const reports = await performanceService.getDailyReports(7)
  console.log(`✓ Fetched ${reports.totalDays} days`)
  console.log(`✓ Daily Avg Practice: ${reports.aggregates.avgPracticeHoursPerDay} hrs/day`)
  console.log(`✓ Total EXP in window: ${reports.aggregates.totalExpGained}`)

  // 7. Test Revision Topics
  console.log("\n7. Testing getRevisionTopics()...")
  const topics = await performanceService.getRevisionTopics("all", "all")
  console.log(`✓ Total Tracked Topics: ${topics.summary.total}`)
  console.log(`✓ Status breakdown: Due Today: ${topics.summary.dueToday}, Overdue: ${topics.summary.overdue}, On Schedule: ${topics.summary.onSchedule}, Mastered: ${topics.summary.mastered}`)

  // 8. Test Mock Tests
  console.log("\n8. Testing getMockTestHistory()...")
  const mocks = await performanceService.getMockTestHistory(10)
  console.log(`✓ Total Mock Attempts: ${mocks.totalAttempts}`)

  // 9. Test Pomodoro
  console.log("\n9. Testing getPomodoroFocusSessions()...")
  const pomodoro = await performanceService.getPomodoroFocusSessions(10)
  console.log(`✓ Total Pomodoro Sessions: ${pomodoro.totalSessions}`)

  // 10. Test Server Instance
  console.log("\n10. Testing McpServer initialization...")
  const server = createMcpServer()
  console.log(`✓ McpServer instance created successfully: ${server.server.name}`)

  console.log("\n=== ALL MCP SELF-TESTS PASSED SUCCESSFULLY! ===")
}

runTests().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})

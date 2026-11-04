import test from "node:test"
import assert from "node:assert/strict"
import {
  compute24HourDayTimeline,
  compute7DayPatternMatrix,
  computeWeeklyTimeWiseAverage,
  getChronologicalSessionsForDay,
} from "../lib/focus-timeline.ts"

test("focus timeline functions handle clean zero-session state gracefully", () => {
  // 1. Chronological sessions for day
  const chrono = getChronologicalSessionsForDay([])
  assert.equal(chrono.length, 0, "No sessions should produce 0 chronological blocks")

  // 2. 24-hour day timeline
  const timeline24 = compute24HourDayTimeline([], new Date())
  assert.equal(timeline24.length, 24, "Day timeline must always contain exactly 24 hourly bins")
  timeline24.forEach((bin, idx) => {
    assert.equal(bin.hour, idx)
    assert.equal(bin.focusMinutes, 0)
    assert.equal(bin.pauseMinutes, 0)
    assert.equal(bin.breakMinutes, 0)
    assert.equal(bin.totalActiveMinutes, 0)
    assert.equal(bin.idleMinutes, 60)
  })

  // 3. 7-Day Pattern Matrix
  const matrix = compute7DayPatternMatrix([])
  assert.equal(matrix.rows.length, 7, "7-day matrix must return exactly 7 day rows")
  assert.equal(matrix.avgDailyFocusMinutes, 0)
  assert.equal(matrix.avgDailyPauseMinutes, 0)
  assert.equal(matrix.avgDailyBreakMinutes, 0)
  assert.equal(matrix.overallStamina, 100, "Default stamina with 0 pauses should be 100%")

  // 4. Weekly 24-Hour Time-Wise Average
  const weeklyAvg = computeWeeklyTimeWiseAverage([])
  assert.equal(weeklyAvg.length, 24, "Weekly average curve must return 24 hours")
  weeklyAvg.forEach((item, idx) => {
    assert.equal(item.hour, idx)
    assert.equal(item.avgFocusMinutes, 0)
    assert.equal(item.avgPauseMinutes, 0)
    assert.equal(item.avgBreakMinutes, 0)
    assert.equal(item.totalDaysStudied, 0)
    assert.equal(item.consistencyScore, 0)
    assert.equal(item.isPeakFocusHour, undefined)
  })
})

test("legacy seed IDs are correctly identified and can be filtered cleanly", () => {
  const mixedSessions = [
    { id: "pomodoro-seed-1", durationMinutes: 180, completedAt: new Date().toISOString() },
    { id: "seed-rel-0-1", durationMinutes: 90, completedAt: new Date().toISOString() },
    { id: "user-real-session-123", durationMinutes: 45, completedAt: new Date().toISOString() },
  ]

  const isLegacySeed = (id) => id?.startsWith("pomodoro-seed-") || id?.startsWith("seed-rel-")
  const sanitized = mixedSessions.filter((s) => !isLegacySeed(s.id))

  assert.equal(sanitized.length, 1)
  assert.equal(sanitized[0].id, "user-real-session-123")

  const mixedTodos = [
    { id: "todo-seed-1", title: "Watch CN Lectures 5–7" },
    { id: "todo-seed-2", title: "Operating Systems Paging" },
    { id: "custom-user-todo-999", title: "My Real GATE Practice" },
  ]
  const sanitizedTodos = mixedTodos.filter((t) => !t.id?.startsWith("todo-seed-"))
  assert.equal(sanitizedTodos.length, 1)
  assert.equal(sanitizedTodos[0].id, "custom-user-todo-999")
})

test("focus timeline calculates chronological blocks with live active session", () => {
  const now = new Date()
  const liveState = {
    status: "running",
    mode: "work",
    startedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // started 30 mins ago
    lastPausedAt: null,
    activeDurationMinutes: 45,
    timeLeft: 15 * 60,
    pauseCount: 0,
    totalPausedSeconds: 0,
    description: "Active Real Study Session",
  }

  const chrono = getChronologicalSessionsForDay([], now, liveState)
  assert.equal(chrono.length, 1, "Live active session should be included as an in-flight block")
  assert.equal(chrono[0].title, "Active Real Study Session (Running Now)")
  assert.equal(chrono[0].id, "live-session-block")
  assert.equal(chrono[0].netFocusMinutes, 30)
})

test("focus timeline allocates multi-hour sessions that cross midnight properly across calendar days", () => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0)

  const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 0, 0)
  const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 0, 0)

  const session = {
    id: "midnight-session-1",
    startedAt: startLocal.toISOString(),
    completedAt: endLocal.toISOString(),
    durationMinutes: 120,
    focusType: "practice",
    status: "completed",
    pauseCount: 0,
    totalPausedSeconds: 0,
  }

  // 1. Today's timeline: must contain the post-midnight portion (hour 0), NOT yesterday's hour 23
  const resultToday = compute24HourDayTimeline([session], today)
  assert.equal(resultToday.length, 24)
  assert.equal(resultToday[0].focusMinutes, 60, "Hour 0 of today should contain 60 minutes")
  assert.equal(resultToday[23].focusMinutes, 0, "Hour 23 of today must NOT contain yesterday's late night study")

  // 2. Yesterday's timeline: must contain the pre-midnight portion (hour 23)
  const resultYesterday = compute24HourDayTimeline([session], yesterday)
  assert.equal(resultYesterday.length, 24)
  assert.equal(resultYesterday[23].focusMinutes, 60, "Hour 23 of yesterday should contain 60 minutes")
  assert.equal(resultYesterday[0].focusMinutes, 0, "Hour 0 of yesterday should not contain session")

  // 3. Chronological sessions for each day
  const chronoToday = getChronologicalSessionsForDay([session], today)
  assert.equal(chronoToday.length, 1)
  assert.equal(chronoToday[0].startMinutesOfDay, 0, "Today's block starts at midnight (00:00)")
  assert.equal(chronoToday[0].durationMinutes, 60)

  const chronoYesterday = getChronologicalSessionsForDay([session], yesterday)
  assert.equal(chronoYesterday.length, 1)
  assert.equal(chronoYesterday[0].startMinutesOfDay, 23 * 60, "Yesterday's block starts at 23:00")
  assert.equal(chronoYesterday[0].durationMinutes, 60)
})



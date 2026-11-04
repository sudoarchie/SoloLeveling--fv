/**
 * Focus Timeline & 24-Hour Telemetry Intelligence
 * Computes exact hour-by-hour (00:00 to 23:59) distribution of:
 * 1. Running Focus Time (minutes)
 * 2. Pauses Taken (minutes)
 * 3. Breaks Taken (minutes)
 * And provides 7-Day Time-Wise Averages across all 24 hours of the day.
 */

import { format, subDays, isSameDay, startOfDay, addHours } from "date-fns"
import type { PomodoroSessionRecord } from "@/hooks/usePomodoro"
import { formatHourLabel } from "./study-pattern.ts"

export interface HourlyTelemetry {
  hour: number // 0 to 23
  label: string // "12 AM", "4 AM", "12 PM", etc.
  windowLabel: string // "04:00 – 05:00"
  focusMinutes: number
  pauseMinutes: number
  breakMinutes: number
  totalActiveMinutes: number
  idleMinutes: number
  pauseCount: number
  sessionDescriptions: string[]
  isPeakFocus?: boolean
  isPeakPause?: boolean
}

export interface ChronologicalSessionBlock {
  id: string
  title: string
  focusType: string
  startedAt: string
  completedAt: string
  startTimeFormatted: string
  endTimeFormatted: string
  startMinutesOfDay: number
  durationMinutes: number
  netFocusMinutes: number
  pausedMinutes: number
  isBreak: boolean
  staminaPct: number
  pauseCount: number
  pauses: Array<{
    timeFormatted: string
    durationMinutes: number
    description: string
  }>
}

export interface DayPatternRow {
  date: Date
  dayName: string // "Mon", "Tue", etc.
  dateLabel: string // "Today", "Yesterday", or "Nov 3"
  isToday: boolean
  totalFocusMinutes: number
  totalPauseMinutes: number
  totalBreakMinutes: number
  staminaScore: number
  windows: {
    earlyMorning: { focus: number; pauses: number; breaks: number } // 04:00 - 08:00
    morning: { focus: number; pauses: number; breaks: number } // 08:00 - 12:00
    afternoon: { focus: number; pauses: number; breaks: number } // 12:00 - 16:00
    evening: { focus: number; pauses: number; breaks: number } // 16:00 - 20:00
    night: { focus: number; pauses: number; breaks: number } // 20:00 - 04:00
  }
}

export interface WeeklyTimeWiseHourlyAverage {
  hour: number
  label: string
  windowLabel: string
  avgFocusMinutes: number
  avgPauseMinutes: number
  avgBreakMinutes: number
  totalDaysStudied: number
  consistencyScore: number
  isPeakFocusHour?: boolean
  isPeakPauseHour?: boolean
}

/**
 * Extracts chronological sessions for a specific day to power the visual timeline swimlane
 */
export function getChronologicalSessionsForDay(
  sessions: PomodoroSessionRecord[],
  targetDate: Date = new Date(),
  liveState?: ActiveSessionLiveState,
): ChronologicalSessionBlock[] {
  const blocks: ChronologicalSessionBlock[] = []

  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
  const targetDayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 0, 0, 0, 0)

  const daySessions = sessions.filter((s) => {
    const start = s.startedAt
      ? new Date(s.startedAt)
      : s.completedAt
        ? new Date(new Date(s.completedAt).getTime() - (s.durationMinutes || 25) * 60 * 1000)
        : null
    const end = s.completedAt
      ? new Date(s.completedAt)
      : start
        ? new Date(start.getTime() + (s.durationMinutes || 25) * 60 * 1000)
        : null
    if (!start || !end) return false
    return end.getTime() > targetDayStart.getTime() && start.getTime() < targetDayEnd.getTime()
  })

  daySessions.forEach((s) => {
    const start = s.startedAt
      ? new Date(s.startedAt)
      : s.completedAt
        ? new Date(new Date(s.completedAt).getTime() - (s.durationMinutes || 25) * 60 * 1000)
        : new Date()
    const end = s.completedAt
      ? new Date(s.completedAt)
      : new Date(start.getTime() + (s.durationMinutes || 25) * 60 * 1000)

    const overlapStartMs = Math.max(start.getTime(), targetDayStart.getTime())
    const overlapEndMs = Math.min(end.getTime(), targetDayEnd.getTime())
    if (overlapEndMs <= overlapStartMs) return

    const overlapStart = new Date(overlapStartMs)
    const overlapEnd = new Date(overlapEndMs)
    const totalSessionDurMs = Math.max(1000, end.getTime() - start.getTime())
    const overlapRatio = Math.min(1, (overlapEndMs - overlapStartMs) / totalSessionDurMs)

    const dur = Math.max(1, Math.round((overlapEndMs - overlapStartMs) / (60 * 1000)))
    const totalPaused = Math.round((s.totalPausedSeconds || 0) / 60)
    const paused = Math.round(totalPaused * overlapRatio)
    const netFocus = Math.max(0, dur - paused)
    const isBreak =
      s.description?.toLowerCase().includes("break") ||
      s.description?.toLowerCase().includes("rest") ||
      (s.preset === "custom" && s.durationMinutes <= 20 && s.focusType === "other")

    const stamina = dur > 0 ? Math.round((netFocus / dur) * 100) : 100

    const pausesList: Array<{ timeFormatted: string; durationMinutes: number; description: string }> = []
    if (Array.isArray(s.events)) {
      s.events.forEach((ev) => {
        if (ev.type === "pause" || ev.type === "resume") {
          const pauseSec = ev.pauseDurationSeconds || 0
          if (pauseSec > 0 || ev.note || ev.pauseDescription) {
            pausesList.push({
              timeFormatted: ev.timestamp
                ? new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Pause",
              durationMinutes: Math.max(1, Math.round(pauseSec / 60)),
              description: ev.pauseDescription || ev.note || "Brief break",
            })
          }
        }
      })
    }

    if (pausesList.length === 0 && (s.pauseCount || 0) > 0) {
      pausesList.push({
        timeFormatted: overlapStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationMinutes: paused,
        description: s.lastPauseDescription || `${s.pauseCount} pause event(s)`,
      })
    }

    blocks.push({
      id: s.id,
      title: s.description || (isBreak ? "Recharge Break" : "Deep Focus Session"),
      focusType: isBreak ? "break" : s.focusType || "practice",
      startedAt: overlapStart.toISOString(),
      completedAt: overlapEnd.toISOString(),
      startTimeFormatted: overlapStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      endTimeFormatted: overlapEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      startMinutesOfDay: overlapStart.getHours() * 60 + overlapStart.getMinutes(),
      durationMinutes: dur,
      netFocusMinutes: netFocus,
      pausedMinutes: paused,
      isBreak,
      staminaPct: stamina,
      pauseCount: Math.round((s.pauseCount || 0) * overlapRatio),
      pauses: pausesList,
    })
  })

  // Add live running/paused session if on today
  if (liveState && (liveState.status === "running" || liveState.status === "paused") && liveState.startedAt) {
    const liveStart = new Date(liveState.startedAt)
    if (isSameDay(liveStart, targetDate)) {
      const now = new Date()
      const totalElapsedSecs = Math.max(0, liveState.activeDurationMinutes * 60 - liveState.timeLeft)
      const livePausedSecs = liveState.totalPausedSeconds || 0
      const liveFocusSecs = Math.max(0, totalElapsedSecs - livePausedSecs)

      const durMins = Math.max(1, Math.round(totalElapsedSecs / 60))
      const pausedMins = Math.round(livePausedSecs / 60)
      const focusMins = Math.round(liveFocusSecs / 60)
      const isBreak = liveState.mode === "break"

      blocks.push({
        id: "live-session-block",
        title: `${liveState.description || "Active Session"} (Running Now)`,
        focusType: isBreak ? "break" : "practice",
        startedAt: liveStart.toISOString(),
        completedAt: now.toISOString(),
        startTimeFormatted: liveStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        endTimeFormatted: "Now",
        startMinutesOfDay: liveStart.getHours() * 60 + liveStart.getMinutes(),
        durationMinutes: durMins,
        netFocusMinutes: focusMins,
        pausedMinutes: pausedMins,
        isBreak,
        staminaPct: durMins > 0 ? Math.round((focusMins / durMins) * 100) : 100,
        pauseCount: liveState.pauseCount || 0,
        pauses: liveState.totalPausedSeconds > 0 ? [{
          timeFormatted: "In progress",
          durationMinutes: pausedMins,
          description: "Live session pauses",
        }] : [],
      })
    }
  }

  // Sort chronologically
  return blocks.sort((a, b) => a.startMinutesOfDay - b.startMinutesOfDay)
}

/**
 * Computes 7-Day Matrix of Days vs 5 Circadian Time Windows
 */
export function compute7DayPatternMatrix(
  sessions: PomodoroSessionRecord[],
  liveState?: ActiveSessionLiveState,
): {
  rows: DayPatternRow[]
  peakFocusWindow: string
  peakLagWindow: string
  avgDailyFocusMinutes: number
  avgDailyPauseMinutes: number
  avgDailyBreakMinutes: number
  overallStamina: number
} {
  const rows: DayPatternRow[] = []
  const today = new Date()

  for (let i = 0; i < 7; i++) {
    const targetDate = subDays(today, i)
    const blocks = getChronologicalSessionsForDay(
      sessions,
      targetDate,
      i === 0 ? liveState : undefined,
    )

    let totalFocus = 0
    let totalPause = 0
    let totalBreak = 0

    const windows = {
      earlyMorning: { focus: 0, pauses: 0, breaks: 0 }, // 4am - 8am
      morning: { focus: 0, pauses: 0, breaks: 0 },      // 8am - 12pm
      afternoon: { focus: 0, pauses: 0, breaks: 0 },    // 12pm - 4pm
      evening: { focus: 0, pauses: 0, breaks: 0 },      // 4pm - 8pm
      night: { focus: 0, pauses: 0, breaks: 0 },        // 8pm - 4am
    }

    blocks.forEach((b) => {
      const h = Math.floor(b.startMinutesOfDay / 60)
      if (b.isBreak) {
        totalBreak += b.durationMinutes
      } else {
        totalFocus += b.netFocusMinutes
        totalPause += b.pausedMinutes
      }

      let winKey: keyof typeof windows = "night"
      if (h >= 4 && h < 8) winKey = "earlyMorning"
      else if (h >= 8 && h < 12) winKey = "morning"
      else if (h >= 12 && h < 16) winKey = "afternoon"
      else if (h >= 16 && h < 20) winKey = "evening"

      if (b.isBreak) {
        windows[winKey].breaks += b.durationMinutes
      } else {
        windows[winKey].focus += b.netFocusMinutes
        windows[winKey].pauses += b.pausedMinutes
      }
    })

    const dayStamina =
      totalFocus + totalPause > 0
        ? Math.round((totalFocus / (totalFocus + totalPause)) * 100)
        : 100

    rows.push({
      date: targetDate,
      dayName: targetDate.toLocaleDateString([], { weekday: "short" }),
      dateLabel:
        i === 0
          ? "Today"
          : i === 1
            ? "Yesterday"
            : targetDate.toLocaleDateString([], { month: "short", day: "numeric" }),
      isToday: i === 0,
      totalFocusMinutes: totalFocus,
      totalPauseMinutes: totalPause,
      totalBreakMinutes: totalBreak,
      staminaScore: dayStamina,
      windows,
    })
  }

  // Aggregate stats across the 7 days
  const sumFocus = rows.reduce((acc, r) => acc + r.totalFocusMinutes, 0)
  const sumPause = rows.reduce((acc, r) => acc + r.totalPauseMinutes, 0)
  const sumBreak = rows.reduce((acc, r) => acc + r.totalBreakMinutes, 0)

  const avgDailyFocusMinutes = Math.round(sumFocus / 7)
  const avgDailyPauseMinutes = Math.round(sumPause / 7)
  const avgDailyBreakMinutes = Math.round(sumBreak / 7)
  const overallStamina = sumFocus + sumPause > 0 ? Math.round((sumFocus / (sumFocus + sumPause)) * 100) : 100

  // Calculate window totals to detect prime vs lag windows
  const winTotals = {
    earlyMorning: { focus: 0, pauses: 0 },
    morning: { focus: 0, pauses: 0 },
    afternoon: { focus: 0, pauses: 0 },
    evening: { focus: 0, pauses: 0 },
    night: { focus: 0, pauses: 0 },
  }

  rows.forEach((r) => {
    winTotals.earlyMorning.focus += r.windows.earlyMorning.focus
    winTotals.earlyMorning.pauses += r.windows.earlyMorning.pauses
    winTotals.morning.focus += r.windows.morning.focus
    winTotals.morning.pauses += r.windows.morning.pauses
    winTotals.afternoon.focus += r.windows.afternoon.focus
    winTotals.afternoon.pauses += r.windows.afternoon.pauses
    winTotals.evening.focus += r.windows.evening.focus
    winTotals.evening.pauses += r.windows.evening.pauses
    winTotals.night.focus += r.windows.night.focus
    winTotals.night.pauses += r.windows.night.pauses
  })

  let peakFocusKey = "earlyMorning"
  let maxWinFocus = -1
  let peakLagKey = "afternoon"
  let maxWinPauses = -1

  const winNames: Record<string, string> = {
    earlyMorning: "Early Morning (4am – 8am)",
    morning: "Morning (8am – 12pm)",
    afternoon: "Afternoon (12pm – 4pm)",
    evening: "Evening (4pm – 8pm)",
    night: "Night (8pm – 4am)",
  }

  Object.entries(winTotals).forEach(([k, val]) => {
    if (val.focus > maxWinFocus) {
      maxWinFocus = val.focus
      peakFocusKey = k
    }
    if (val.pauses > maxWinPauses) {
      maxWinPauses = val.pauses
      peakLagKey = k
    }
  })

  return {
    rows,
    peakFocusWindow: winNames[peakFocusKey] || "Early Morning (4am – 8am)",
    peakLagWindow: winNames[peakLagKey] || "Afternoon (12pm – 4pm)",
    avgDailyFocusMinutes,
    avgDailyPauseMinutes,
    avgDailyBreakMinutes,
    overallStamina,
  }
}

export interface ActiveSessionLiveState {
  status: "idle" | "running" | "paused" | "completed"
  mode: "work" | "break"
  startedAt: string | null
  lastPausedAt: string | null
  activeDurationMinutes: number
  timeLeft: number
  pauseCount: number
  totalPausedSeconds: number
  description: string
}

/**
 * Computes the 24-hour breakdown for a single given date (00:00 to 23:59)
 */
export function compute24HourDayTimeline(
  sessions: PomodoroSessionRecord[],
  targetDate: Date = new Date(),
  liveState?: ActiveSessionLiveState,
): HourlyTelemetry[] {
  const result: HourlyTelemetry[] = []

  for (let h = 0; h < 24; h++) {
    const startStr = `${String(h).padStart(2, "0")}:00`
    const nextH = (h + 1) % 24
    const endStr = `${String(nextH).padStart(2, "0")}:00`

    result.push({
      hour: h,
      label: formatHourLabel(h),
      windowLabel: `${startStr} – ${endStr}`,
      focusMinutes: 0,
      pauseMinutes: 0,
      breakMinutes: 0,
      totalActiveMinutes: 0,
      idleMinutes: 60,
      pauseCount: 0,
      sessionDescriptions: [],
    })
  }

  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
  const targetDayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 0, 0, 0, 0)

  sessions.forEach((session) => {
    const sessionStart = session.startedAt
      ? new Date(session.startedAt)
      : session.completedAt
        ? new Date(new Date(session.completedAt).getTime() - (session.durationMinutes || 25) * 60 * 1000)
        : null

    const sessionEnd = session.completedAt
      ? new Date(session.completedAt)
      : sessionStart
        ? new Date(sessionStart.getTime() + (session.durationMinutes || 25) * 60 * 1000)
        : null

    if (!sessionStart || !sessionEnd) return

    const overlapStartMs = Math.max(sessionStart.getTime(), targetDayStart.getTime())
    const overlapEndMs = Math.min(sessionEnd.getTime(), targetDayEnd.getTime())
    if (overlapEndMs <= overlapStartMs) return

    const totalDurationMs = Math.max(1000, sessionEnd.getTime() - sessionStart.getTime())
    const overlapDurationMinutes = Math.max(1, Math.round((overlapEndMs - overlapStartMs) / (60 * 1000)))
    const overlapRatio = Math.min(1, (overlapEndMs - overlapStartMs) / totalDurationMs)

    const totalPausedMinutes = Math.round((session.totalPausedSeconds || 0) / 60)
    const pausedMinutes = Math.round(totalPausedMinutes * overlapRatio)
    const netFocusMinutes = Math.max(0, overlapDurationMinutes - pausedMinutes)
    const isBreakSession =
      session.description?.toLowerCase().includes("break") ||
      (session.preset === "custom" && session.durationMinutes <= 15 && session.description?.toLowerCase().includes("rest"))

    // Allocate across hours spanned strictly on targetDate
    const startHour = new Date(overlapStartMs).getHours()
    const endHour = new Date(overlapEndMs - 1).getHours()

    if (startHour === endHour) {
      const bucket = result[startHour]
      if (bucket) {
        if (isBreakSession) {
          bucket.breakMinutes = Math.min(60, bucket.breakMinutes + overlapDurationMinutes)
        } else {
          bucket.focusMinutes = Math.min(60, bucket.focusMinutes + netFocusMinutes)
          bucket.pauseMinutes = Math.min(60, bucket.pauseMinutes + pausedMinutes)
        }
        bucket.pauseCount += Math.round((session.pauseCount || 0) * overlapRatio)
        if (session.description && !bucket.sessionDescriptions.includes(session.description)) {
          bucket.sessionDescriptions.push(session.description)
        }
      }
    } else {
      const hoursCount = Math.max(1, endHour - startHour + 1)
      const focusPerHour = Math.round((netFocusMinutes / hoursCount) * 10) / 10
      const pausePerHour = Math.round((pausedMinutes / hoursCount) * 10) / 10
      const breakPerHour = Math.round((overlapDurationMinutes / hoursCount) * 10) / 10

      for (let cur = startHour; cur <= endHour; cur++) {
        const bucket = result[cur]
        if (bucket) {
          if (isBreakSession) {
            bucket.breakMinutes = Math.min(60, Math.round(bucket.breakMinutes + breakPerHour))
          } else {
            bucket.focusMinutes = Math.min(60, Math.round(bucket.focusMinutes + focusPerHour))
            bucket.pauseMinutes = Math.min(60, Math.round(bucket.pauseMinutes + pausePerHour))
          }
          bucket.pauseCount += Math.round(((session.pauseCount || 0) * overlapRatio) / hoursCount)
          if (session.description && !bucket.sessionDescriptions.includes(session.description)) {
            bucket.sessionDescriptions.push(session.description)
          }
        }
      }
    }
  })

  // If live session is active today, add live telemetry to current hour
  if (liveState && (liveState.status === "running" || liveState.status === "paused") && liveState.startedAt) {
    const liveStartDate = new Date(liveState.startedAt)
    if (isSameDay(liveStartDate, targetDate)) {
      const now = new Date()
      const currentHour = now.getHours()
      const bucket = result[currentHour]
      if (bucket) {
        const totalElapsedSecs = Math.max(
          0,
          (liveState.activeDurationMinutes * 60) - liveState.timeLeft
        )
        const livePausedSecs = liveState.totalPausedSeconds || 0
        const liveFocusSecs = Math.max(0, totalElapsedSecs - livePausedSecs)

        const liveFocusMins = Math.round(liveFocusSecs / 60)
        const livePauseMins = Math.round(livePausedSecs / 60)

        if (liveState.mode === "break") {
          bucket.breakMinutes = Math.min(60, bucket.breakMinutes + liveFocusMins)
        } else {
          bucket.focusMinutes = Math.min(60, bucket.focusMinutes + liveFocusMins)
          bucket.pauseMinutes = Math.min(60, bucket.pauseMinutes + livePauseMins)
          bucket.pauseCount += liveState.pauseCount || 0
        }
        if (liveState.description && !bucket.sessionDescriptions.includes(liveState.description)) {
          bucket.sessionDescriptions.push(`${liveState.description} (In Progress)`)
        }
      }
    }
  }

  // Calculate totals and idle minutes
  let maxFocus = 0
  let maxPause = 0
  result.forEach((b) => {
    b.totalActiveMinutes = Math.min(60, b.focusMinutes + b.pauseMinutes + b.breakMinutes)
    b.idleMinutes = Math.max(0, 60 - b.totalActiveMinutes)
    if (b.focusMinutes > maxFocus) maxFocus = b.focusMinutes
    if (b.pauseMinutes > maxPause) maxPause = b.pauseMinutes
  })

  // Mark peak hours
  result.forEach((b) => {
    if (maxFocus > 15 && b.focusMinutes === maxFocus) b.isPeakFocus = true
    if (maxPause > 5 && b.pauseMinutes === maxPause) b.isPeakPause = true
  })

  return result
}

/**
 * Computes 1-Week Time-Wise Average for all 24 hours (00:00 to 23:59)
 * Calculates the average minutes spent in Focus, Pause, and Break across the 7 days.
 */
export function computeWeeklyTimeWiseAverage(
  sessions: PomodoroSessionRecord[],
  liveState?: ActiveSessionLiveState,
): WeeklyTimeWiseHourlyAverage[] {
  const dayTimelines: HourlyTelemetry[][] = []

  // Collect timelines for past 7 days (day 0 = today, day 6 = 6 days ago)
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const dayDate = subDays(today, i)
    const timeline = compute24HourDayTimeline(sessions, dayDate, i === 0 ? liveState : undefined)
    dayTimelines.push(timeline)
  }

  const result: WeeklyTimeWiseHourlyAverage[] = []

  for (let h = 0; h < 24; h++) {
    let sumFocus = 0
    let sumPause = 0
    let sumBreak = 0
    let daysWithFocus = 0

    for (let d = 0; d < 7; d++) {
      const hourData = dayTimelines[d][h]
      if (hourData) {
        sumFocus += hourData.focusMinutes
        sumPause += hourData.pauseMinutes
        sumBreak += hourData.breakMinutes
        if (hourData.focusMinutes > 5) {
          daysWithFocus++
        }
      }
    }

    const avgFocus = Math.round((sumFocus / 7) * 10) / 10
    const avgPause = Math.round((sumPause / 7) * 10) / 10
    const avgBreak = Math.round((sumBreak / 7) * 10) / 10
    const consistencyScore = Math.round((daysWithFocus / 7) * 100)

    const startStr = `${String(h).padStart(2, "0")}:00`
    const nextH = (h + 1) % 24
    const endStr = `${String(nextH).padStart(2, "0")}:00`

    result.push({
      hour: h,
      label: formatHourLabel(h),
      windowLabel: `${startStr} – ${endStr}`,
      avgFocusMinutes: avgFocus,
      avgPauseMinutes: avgPause,
      avgBreakMinutes: avgBreak,
      totalDaysStudied: daysWithFocus,
      consistencyScore,
    })
  }

  // Identify peak focus hour and peak pause hour of the week
  let maxAvgFocus = 0
  let maxAvgPause = 0
  result.forEach((r) => {
    if (r.avgFocusMinutes > maxAvgFocus) maxAvgFocus = r.avgFocusMinutes
    if (r.avgPauseMinutes > maxAvgPause) maxAvgPause = r.avgPauseMinutes
  })

  result.forEach((r) => {
    if (maxAvgFocus > 5 && r.avgFocusMinutes === maxAvgFocus) r.isPeakFocusHour = true
    if (maxAvgPause > 2 && r.avgPauseMinutes === maxAvgPause) r.isPeakPauseHour = true
  })

  return result
}


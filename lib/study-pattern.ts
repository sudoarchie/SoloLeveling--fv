/**
 * Study Pattern Intelligence Module
 * Analyzes Pomodoro timer telemetry: start times, pause frequencies, pause durations,
 * and within-session pause timing to evaluate user focus stamina and distraction patterns.
 */

export interface TimerEvent {
  type: "start" | "pause" | "resume" | "complete" | "abandon" | "reset"
  timestamp: string
  timeLeft?: number
  pauseDurationSeconds?: number
  elapsedSeconds?: number
  note?: string
}

export type FocusType = "lecture" | "practice" | "revision" | "mock_test" | "other"

export function normalizeFocusType(
  type?: string | null,
  description?: string | null,
): FocusType {
  if (type) {
    const t = type.toLowerCase().trim()
    if (t === "lecture" || t === "lectures") return "lecture"
    if (t === "practice" || t === "practics" || t === "practicing") return "practice"
    if (t === "revision" || t === "revise" || t === "review") return "revision"
    if (t === "mock_test" || t === "mock" || t === "exam" || t === "test") return "mock_test"
    if (t === "other") return "other"
  }
  if (description) {
    const d = description.toLowerCase()
    if (
      d.includes("lecture") ||
      d.includes("video") ||
      d.includes("class") ||
      d.includes("watch") ||
      d.includes("cn lecture")
    )
      return "lecture"
    if (
      d.includes("revision") ||
      d.includes("recall") ||
      d.includes("formula") ||
      d.includes("notes") ||
      d.includes("summary")
    )
      return "revision"
    if (
      d.includes("mock") ||
      d.includes("exam") ||
      d.includes("test paper") ||
      d.includes("gate 201")
    )
      return "mock_test"
    if (
      d.includes("practice") ||
      d.includes("pyq") ||
      d.includes("question") ||
      d.includes("solve") ||
      d.includes("problem") ||
      d.includes("mcq")
    )
      return "practice"
  }
  return "practice"
}

export interface PomodoroSessionData {
  id?: string
  preset?: string
  focusType?: FocusType
  focus_type?: string
  duration_minutes?: number
  durationMinutes?: number
  description?: string
  status?: string // 'running' | 'paused' | 'completed' | 'abandoned'
  completed?: boolean
  exp_awarded?: number
  expAwarded?: number
  started_at?: string
  startedAt?: string
  ended_at?: string
  endedAt?: string
  completedAt?: string
  pause_count?: number
  pauseCount?: number
  total_paused_seconds?: number
  totalPausedSeconds?: number
  actual_focus_seconds?: number
  actualFocusSeconds?: number
  events?: TimerEvent[]
}

export interface StudyPatternAnalysis {
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  startTimings: {
    primaryWindow: string
    breakdown: {
      morning: number // 05:00 - 11:59
      afternoon: number // 12:00 - 16:59
      evening: number // 17:00 - 20:59
      night: number // 21:00 - 04:59
    }
    recentStartTimes: string[]
  }
  pausePatterns: {
    totalPauses: number
    avgPausesPerSession: number
    totalPausedMinutes: number
    avgPauseDurationMinutes: number
    pauseFrequencyRisk: "HIGH" | "MODERATE" | "LOW"
    pauseFrequencyDescription: string
    timingOfPauses: {
      earlyPausesCount: number // within first 15 mins of starting
      midLatePausesCount: number // after 40+ mins
      diagnosticNote: string
    }
    timeBreakdown: Record<TimeWindowKey, PauseTimeWindowBreakdown>
    hourlyBreakdown: HourlyPauseBreakdown[]
    peakLagWindow?: PeakLagWindowDiagnostic
  }
  activeSessionAnalysis?: {
    status: string
    startedAtFormatted?: string
    pausesSoFar: number
    totalPausedMinutes: number
    currentlyPausedDurationMinutes?: number
    liveAssessment: string
  }
}

export type TimeWindowKey = "morning" | "afternoon" | "evening" | "night"

export interface PauseTimeWindowBreakdown {
  window: TimeWindowKey
  label: string
  hours: string
  pauses: number
  totalPausedMinutes: number
  sessionCount: number
  avgPausesPerSession: number
  percentageOfTotalPauses: number
  isPeakLag: boolean
}

export interface HourlyPauseBreakdown {
  hour: number
  label: string
  window: TimeWindowKey
  pauses: number
  totalPausedMinutes: number
}

export interface LagSolution {
  title: string
  description: string
  type: "interval" | "task" | "environment" | "circadian"
}

export interface PeakLagWindowDiagnostic {
  window: TimeWindowKey | "none"
  label: string
  timeRange: string
  pauseCount: number
  totalPausedMinutes: number
  percentageOfTotalPauses: number
  avgPausesPerSession: number
  lagSeverity: "HIGH" | "MODERATE" | "LOW"
  disturbanceSummary: string
  distractedStateSummary: string
  rootCauseAnalysis: string
  actionableSolutions: LagSolution[]
}

export function getTimeWindowFromHour(hour: number): TimeWindowKey {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 21) return "evening"
  return "night"
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

/**
 * Parses and standardizes session fields regardless of whether they come
 * from Supabase snake_case or local camelCase.
 */
function normalizeSession(s: PomodoroSessionData) {
  const startedAt = s.started_at || s.startedAt
  const endedAt = s.ended_at || s.endedAt || s.completedAt
  const pauseCount = s.pause_count ?? s.pauseCount ?? 0
  const totalPausedSeconds = s.total_paused_seconds ?? s.totalPausedSeconds ?? 0
  const durationMinutes = s.duration_minutes ?? s.durationMinutes ?? 25
  const events = Array.isArray(s.events) ? s.events : []
  const focusType = normalizeFocusType(s.focusType || s.focus_type, s.description)

  return {
    id: s.id,
    preset: s.preset || "25",
    focusType,
    durationMinutes,
    description: s.description || "",
    status: s.status || (s.completed ? "completed" : "active"),
    completed: Boolean(s.completed),
    startedAt: startedAt ? new Date(startedAt) : null,
    endedAt: endedAt ? new Date(endedAt) : null,
    pauseCount,
    totalPausedSeconds,
    events,
  }
}

/**
 * Analyzes session history and active session telemetry to produce deep study pattern insights.
 */
export function analyzeStudyPatterns(
  sessions: PomodoroSessionData[],
  activePomodoro?: any,
): StudyPatternAnalysis {
  const normalized = sessions.map(normalizeSession).filter((s) => s.startedAt !== null)

  const totalSessions = normalized.length
  const completedSessions = normalized.filter((s) => s.completed || s.status === "completed").length
  const abandonedSessions = normalized.filter((s) => s.status === "abandoned").length

  // 1. Starting Timing Analysis
  const timeBreakdown = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  }

  const recentStartTimes: string[] = []

  normalized.forEach((s) => {
    if (!s.startedAt) return
    const hour = s.startedAt.getHours()
    if (hour >= 5 && hour < 12) {
      timeBreakdown.morning++
    } else if (hour >= 12 && hour < 17) {
      timeBreakdown.afternoon++
    } else if (hour >= 17 && hour < 21) {
      timeBreakdown.evening++
    } else {
      timeBreakdown.night++
    }

    if (recentStartTimes.length < 5) {
      const timeStr = s.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const dateStr = s.startedAt.toLocaleDateString([], { month: "short", day: "numeric" })
      recentStartTimes.push(`${dateStr} at ${timeStr}`)
    }
  })

  let primaryWindow = "Flexible / Variable"
  const maxCategory = Math.max(
    timeBreakdown.morning,
    timeBreakdown.afternoon,
    timeBreakdown.evening,
    timeBreakdown.night,
  )
  if (maxCategory > 0) {
    if (maxCategory === timeBreakdown.night) primaryWindow = "Late Night / Night (21:00 - 04:59)"
    else if (maxCategory === timeBreakdown.morning) primaryWindow = "Morning (05:00 - 11:59)"
    else if (maxCategory === timeBreakdown.evening) primaryWindow = "Evening (17:00 - 20:59)"
    else primaryWindow = "Afternoon (12:00 - 16:59)"
  }

  // 2. Pause Frequency & Timing Analysis
  let totalPauses = 0
  let totalPausedSeconds = 0
  let earlyPausesCount = 0 // < 15 mins
  let midLatePausesCount = 0 // > 40 mins

  const windowStats: Record<TimeWindowKey, { pauses: number; pausedSeconds: number; sessions: number }> = {
    morning: { pauses: 0, pausedSeconds: 0, sessions: 0 },
    afternoon: { pauses: 0, pausedSeconds: 0, sessions: 0 },
    evening: { pauses: 0, pausedSeconds: 0, sessions: 0 },
    night: { pauses: 0, pausedSeconds: 0, sessions: 0 },
  }

  const hourlyStats: Array<{ pauses: number; pausedSeconds: number }> = Array.from({ length: 24 }, () => ({
    pauses: 0,
    pausedSeconds: 0,
  }))

  normalized.forEach((s) => {
    totalPauses += s.pauseCount
    totalPausedSeconds += s.totalPausedSeconds

    const sessHour = s.startedAt ? s.startedAt.getHours() : 12
    const sessWindow = getTimeWindowFromHour(sessHour)
    windowStats[sessWindow].sessions++

    // Inspect events for pause timing
    const pauseEvents = s.events.filter((ev) => ev.type === "pause")

    if (pauseEvents.length > 0) {
      pauseEvents.forEach((ev) => {
        if (typeof ev.elapsedSeconds === "number") {
          if (ev.elapsedSeconds < 15 * 60) {
            earlyPausesCount++
          } else if (ev.elapsedSeconds > 40 * 60) {
            midLatePausesCount++
          }
        }

        let evHour = sessHour
        if (ev.timestamp) {
          try {
            const evDate = new Date(ev.timestamp)
            if (!isNaN(evDate.getTime())) {
              evHour = evDate.getHours()
            }
          } catch {}
        }

        const evWindow = getTimeWindowFromHour(evHour)
        const evPauseDuration =
          typeof ev.pauseDurationSeconds === "number" && ev.pauseDurationSeconds > 0
            ? ev.pauseDurationSeconds
            : (s.pauseCount > 0 ? s.totalPausedSeconds / s.pauseCount : 0)

        windowStats[evWindow].pauses++
        windowStats[evWindow].pausedSeconds += evPauseDuration

        hourlyStats[evHour].pauses++
        hourlyStats[evHour].pausedSeconds += evPauseDuration
      })
    } else if (s.pauseCount > 0) {
      // Legacy session or session without separate event list
      windowStats[sessWindow].pauses += s.pauseCount
      windowStats[sessWindow].pausedSeconds += s.totalPausedSeconds

      hourlyStats[sessHour].pauses += s.pauseCount
      hourlyStats[sessHour].pausedSeconds += s.totalPausedSeconds
    }
  })

  const avgPausesPerSession = totalSessions > 0 ? Number((totalPauses / totalSessions).toFixed(1)) : 0
  const totalPausedMinutes = Math.round(totalPausedSeconds / 60)
  const avgPauseDurationMinutes =
    totalPauses > 0 ? Number(((totalPausedSeconds / totalPauses) / 60).toFixed(1)) : 0

  // 2b. Time Window Pause & Lag Distribution
  const pauseTimeBreakdown: Record<TimeWindowKey, PauseTimeWindowBreakdown> = {
    morning: {
      window: "morning",
      label: "Morning",
      hours: "05:00 - 11:59",
      pauses: windowStats.morning.pauses,
      totalPausedMinutes: Math.round(windowStats.morning.pausedSeconds / 60),
      sessionCount: windowStats.morning.sessions,
      avgPausesPerSession:
        windowStats.morning.sessions > 0
          ? Number((windowStats.morning.pauses / windowStats.morning.sessions).toFixed(1))
          : 0,
      percentageOfTotalPauses:
        totalPauses > 0 ? Math.round((windowStats.morning.pauses / totalPauses) * 100) : 0,
      isPeakLag: false,
    },
    afternoon: {
      window: "afternoon",
      label: "Afternoon",
      hours: "12:00 - 16:59",
      pauses: windowStats.afternoon.pauses,
      totalPausedMinutes: Math.round(windowStats.afternoon.pausedSeconds / 60),
      sessionCount: windowStats.afternoon.sessions,
      avgPausesPerSession:
        windowStats.afternoon.sessions > 0
          ? Number((windowStats.afternoon.pauses / windowStats.afternoon.sessions).toFixed(1))
          : 0,
      percentageOfTotalPauses:
        totalPauses > 0 ? Math.round((windowStats.afternoon.pauses / totalPauses) * 100) : 0,
      isPeakLag: false,
    },
    evening: {
      window: "evening",
      label: "Evening",
      hours: "17:00 - 20:59",
      pauses: windowStats.evening.pauses,
      totalPausedMinutes: Math.round(windowStats.evening.pausedSeconds / 60),
      sessionCount: windowStats.evening.sessions,
      avgPausesPerSession:
        windowStats.evening.sessions > 0
          ? Number((windowStats.evening.pauses / windowStats.evening.sessions).toFixed(1))
          : 0,
      percentageOfTotalPauses:
        totalPauses > 0 ? Math.round((windowStats.evening.pauses / totalPauses) * 100) : 0,
      isPeakLag: false,
    },
    night: {
      window: "night",
      label: "Late Night",
      hours: "21:00 - 04:59",
      pauses: windowStats.night.pauses,
      totalPausedMinutes: Math.round(windowStats.night.pausedSeconds / 60),
      sessionCount: windowStats.night.sessions,
      avgPausesPerSession:
        windowStats.night.sessions > 0
          ? Number((windowStats.night.pauses / windowStats.night.sessions).toFixed(1))
          : 0,
      percentageOfTotalPauses:
        totalPauses > 0 ? Math.round((windowStats.night.pauses / totalPauses) * 100) : 0,
      isPeakLag: false,
    },
  }

  const hourlyBreakdown: HourlyPauseBreakdown[] = hourlyStats.map((stat, hr) => ({
    hour: hr,
    label: formatHourLabel(hr),
    window: getTimeWindowFromHour(hr),
    pauses: stat.pauses,
    totalPausedMinutes: Math.round(stat.pausedSeconds / 60),
  }))

  const windowKeys: TimeWindowKey[] = ["morning", "afternoon", "evening", "night"]
  let peakKey: TimeWindowKey = "afternoon"
  let maxWindowPauses = -1
  let maxWindowMinutes = -1

  windowKeys.forEach((key) => {
    const item = pauseTimeBreakdown[key]
    if (
      item.pauses > maxWindowPauses ||
      (item.pauses === maxWindowPauses && item.totalPausedMinutes > maxWindowMinutes)
    ) {
      maxWindowPauses = item.pauses
      maxWindowMinutes = item.totalPausedMinutes
      peakKey = key
    }
  })

  let peakLagWindow: PeakLagWindowDiagnostic

  if (totalPauses === 0 || maxWindowPauses === 0) {
    peakLagWindow = {
      window: "none",
      label: "Zero Interruption Flow",
      timeRange: "All Day",
      pauseCount: 0,
      totalPausedMinutes: 0,
      percentageOfTotalPauses: 0,
      avgPausesPerSession: 0,
      lagSeverity: "LOW",
      disturbanceSummary: "No external disruptions or device interruptions logged.",
      distractedStateSummary: "Flawless focus stamina with zero distraction pauses.",
      rootCauseAnalysis: "Zero pauses recorded across all study windows. You are sustaining unbroken deep flow without friction or distraction leakage.",
      actionableSolutions: [
        {
          title: "Maintain Flow Rituals",
          description: "Keep your current study environment, desk setup, and study hours consistent.",
          type: "circadian",
        },
      ],
    }
  } else {
    pauseTimeBreakdown[peakKey].isPeakLag = true
    const peak = pauseTimeBreakdown[peakKey]
    const lagSeverity: "HIGH" | "MODERATE" | "LOW" =
      peak.pauses >= 4 || peak.percentageOfTotalPauses >= 45
        ? "HIGH"
        : peak.pauses >= 2 || peak.percentageOfTotalPauses >= 30
          ? "MODERATE"
          : "LOW"

    if (peakKey === "afternoon") {
      peakLagWindow = {
        window: "afternoon",
        label: "Afternoon",
        timeRange: "12:00 PM – 4:59 PM",
        pauseCount: peak.pauses,
        totalPausedMinutes: peak.totalPausedMinutes,
        percentageOfTotalPauses: peak.percentageOfTotalPauses,
        avgPausesPerSession: peak.avgPausesPerSession,
        lagSeverity,
        disturbanceSummary: "Ambient household noise, message notifications, social calls, or peer interruptions during peak daytime hours.",
        distractedStateSummary: "Post-lunch circadian somnolence (food coma), natural dip in body temperature and cortisol, and mental fatigue from morning tasks.",
        rootCauseAnalysis: `Your primary lagging period is the Afternoon (${peak.pauses} pauses, ${peak.totalPausedMinutes}m lost — ${peak.percentageOfTotalPauses}% of all pauses). This typically stems from the postprandial circadian dip colliding with daytime household or phone distractions. Attempting 90-minute deep blocks here without an active buffer often leads to mind-wandering and frequent pauses.`,
        actionableSolutions: [
          {
            title: "Switch to 25m Pomodoro Sprints",
            description: "Instead of long 90m blocks, use 25m or 30m sprints in the afternoon. Shorter horizons dramatically reduce the urge to pause.",
            type: "interval",
          },
          {
            title: "Active PYQ Solving Over Video Lectures",
            description: "Passive video watching induces drowsiness. Switch afternoon blocks to active problem-solving or flashcard drills.",
            type: "task",
          },
          {
            title: "Pre-Session Sun & Hydration Reset",
            description: "Take a 10-minute walk in natural sunlight and drink a large glass of cold water before starting your 1 PM block.",
            type: "circadian",
          },
          {
            title: "Aggressive Notification Lockdown",
            description: "Place your phone in another room or activate 'Do Not Disturb' to eliminate the phone check reflex during daytime.",
            type: "environment",
          },
        ],
      }
    } else if (peakKey === "night") {
      peakLagWindow = {
        window: "night",
        label: "Late Night",
        timeRange: "9:00 PM – 4:59 AM",
        pauseCount: peak.pauses,
        totalPausedMinutes: peak.totalPausedMinutes,
        percentageOfTotalPauses: peak.percentageOfTotalPauses,
        avgPausesPerSession: peak.avgPausesPerSession,
        lagSeverity,
        disturbanceSummary: "Social media browsing, streaming urge, Discord/WhatsApp group chatter.",
        distractedStateSummary: "Accumulated sleep pressure (adenosine buildup), cognitive fatigue, prefrontal cortex exhaustion, and blue light eye strain.",
        rootCauseAnalysis: `Your primary lagging period is Late Night (${peak.pauses} pauses, ${peak.totalPausedMinutes}m lost — ${peak.percentageOfTotalPauses}% of all pauses). Your brain's willpower and executive control are biologically depleted after a full day, leading to rapid attention decay and micro-interruptions.`,
        actionableSolutions: [
          {
            title: "Enforce a 11:30 PM Hard Curfew",
            description: "End study blocks by 11:30 PM. Forcing study past midnight trades tomorrow's analytical sharpness for low-efficiency hours.",
            type: "circadian",
          },
          {
            title: "Formula & Spaced Recall Only",
            description: "Avoid tackling hard new problem sets late at night. Reserve this slot for light formula review or flashcard review.",
            type: "task",
          },
          {
            title: "20-Minute Micro-Blocks",
            description: "If night study is required, use tight 20-minute blocks with 5-minute active stretch breaks to fight drowsiness.",
            type: "interval",
          },
          {
            title: "Warm Screen Temperature & Dark Room Shield",
            description: "Enable night-shift warm color modes and turn off non-essential notifications to reduce neurological arousal.",
            type: "environment",
          },
        ],
      }
    } else if (peakKey === "morning") {
      peakLagWindow = {
        window: "morning",
        label: "Morning",
        timeRange: "5:00 AM – 11:59 AM",
        pauseCount: peak.pauses,
        totalPausedMinutes: peak.totalPausedMinutes,
        percentageOfTotalPauses: peak.percentageOfTotalPauses,
        avgPausesPerSession: peak.avgPausesPerSession,
        lagSeverity,
        disturbanceSummary: "Morning household commotion, checking incoming morning emails/news, or unexpected errands.",
        distractedStateSummary: "Startup friction, sleep inertia, hesitation to begin challenging problem sets, or wandering attention during warmup.",
        rootCauseAnalysis: `Your primary lagging period is Morning (${peak.pauses} pauses, ${peak.totalPausedMinutes}m lost — ${peak.percentageOfTotalPauses}% of all pauses). This points to warmup friction—initial resistance entering the flow state right after starting.`,
        actionableSolutions: [
          {
            title: "The 5-Minute Immersion Rule",
            description: "Commit to studying for just 5 minutes without touching any other device or tab. Once past the 5-minute barrier, flow takes over.",
            type: "interval",
          },
          {
            title: "Prepare Desk The Night Before",
            description: "Open the exact problem sheet or PDF the night before so activation energy is near zero when you sit down.",
            type: "environment",
          },
          {
            title: "Hydration & Sunlight Upon Waking",
            description: "Drink 500ml of water and get morning daylight within 30 minutes of waking to clear adenosine sleep inertia immediately.",
            type: "circadian",
          },
          {
            title: "Zero-Phone Morning Routine",
            description: "Do not open social media or messaging apps until your first focus block is 100% completed.",
            type: "environment",
          },
        ],
      }
    } else {
      peakLagWindow = {
        window: "evening",
        label: "Evening",
        timeRange: "5:00 PM – 8:59 PM",
        pauseCount: peak.pauses,
        totalPausedMinutes: peak.totalPausedMinutes,
        percentageOfTotalPauses: peak.percentageOfTotalPauses,
        avgPausesPerSession: peak.avgPausesPerSession,
        lagSeverity,
        disturbanceSummary: "Household dinner preparations, family members returning home, peer social plans.",
        distractedStateSummary: "End-of-day cognitive transition burnout after day classes, college lectures, or work commitments.",
        rootCauseAnalysis: `Your primary lagging period is the Evening (${peak.pauses} pauses, ${peak.totalPausedMinutes}m lost — ${peak.percentageOfTotalPauses}% of all pauses). Shifting from daytime tasks to focused self-study without an intentional buffer causes attention fragmentation.`,
        actionableSolutions: [
          {
            title: "20-Minute Decompression Buffer",
            description: "Take a 20-minute physical walk, shower, or tea break between daytime commitments and your evening study chamber.",
            type: "circadian",
          },
          {
            title: "Inform Family / Study Boundary",
            description: "Set a clear boundary with household members that 6 PM to 8 PM is your uninterrupted deep focus window.",
            type: "environment",
          },
          {
            title: "45-Minute Focused Sprints",
            description: "Cap evening sessions at 45 minutes with structured 10-minute active stretch breaks.",
            type: "interval",
          },
          {
            title: "Active Practice & Revision",
            description: "Use evening for problem solving or revising what you studied earlier in the week to keep cognition engaged.",
            type: "task",
          },
        ],
      }
    }
  }

  let pauseFrequencyRisk: "HIGH" | "MODERATE" | "LOW" = "LOW"
  let pauseFrequencyDescription = "High Continuous Focus: Very few or no pauses taken. Excellent flow state."

  if (avgPausesPerSession >= 3.0 || (totalSessions > 0 && totalPauses / totalSessions >= 2.5)) {
    pauseFrequencyRisk = "HIGH"
    pauseFrequencyDescription = `Too Many Pauses Detected: Averaging ${avgPausesPerSession} pauses per focus session (total ${totalPausedMinutes}m paused). High likelihood of focus fragmentation, phone distraction, or cognitive fatigue.`
  } else if (avgPausesPerSession >= 1.2) {
    pauseFrequencyRisk = "MODERATE"
    pauseFrequencyDescription = `Moderate Pauses: Averaging ${avgPausesPerSession} pauses per focus block. Manageable, but monitor for creeping interruption habits.`
  }

  let diagnosticNote = "Pauses are evenly distributed."
  if (earlyPausesCount > midLatePausesCount && earlyPausesCount >= 2) {
    diagnosticNote = `Startup Friction Detected: ${earlyPausesCount} pauses occurred within the first 15 minutes of starting. The student experiences initial resistance entering flow (warmup hesitation / checking devices).`
  } else if (midLatePausesCount > earlyPausesCount && midLatePausesCount >= 2) {
    diagnosticNote = `Endurance Depletion: Most pauses occur after 40+ minutes of continuous study, aligning with normal ultradian fatigue.`
  }

  // 3. Active Session Analysis (if currently active/paused)
  let activeSessionAnalysis: StudyPatternAnalysis["activeSessionAnalysis"] = undefined

  if (activePomodoro) {
    const actStatus = activePomodoro.status || "idle"
    const actPauses = activePomodoro.pauseCount ?? 0
    const actPausedSecs = activePomodoro.totalPausedSeconds ?? 0
    const actPausedMins = Math.round(actPausedSecs / 60)
    let actStartedFormatted: string | undefined = undefined

    if (activePomodoro.startedAt) {
      try {
        const startDate = new Date(activePomodoro.startedAt)
        const minsAgo = Math.max(0, Math.round((Date.now() - startDate.getTime()) / 60000))
        actStartedFormatted = `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${minsAgo}m ago)`
      } catch {}
    }

    let currentlyPausedDurationMinutes: number | undefined = undefined
    if (actStatus === "paused" && activePomodoro.lastPausedAt) {
      const pauseDuration = Math.max(
        0,
        Math.round((Date.now() - new Date(activePomodoro.lastPausedAt).getTime()) / 60000),
      )
      currentlyPausedDurationMinutes = pauseDuration
    }

    let liveAssessment = "Session in steady progress."
    if (actStatus === "paused") {
      liveAssessment = `Currently PAUSED ${currentlyPausedDurationMinutes !== undefined ? `(for ${currentlyPausedDurationMinutes}m)` : ""}. Total pauses in this block: ${actPauses}.`
    } else if (actPauses >= 3) {
      liveAssessment = `High pause rate during current block: ${actPauses} pauses logged so far (${actPausedMins}m lost to pauses).`
    }

    activeSessionAnalysis = {
      status: actStatus,
      startedAtFormatted: actStartedFormatted,
      pausesSoFar: actPauses,
      totalPausedMinutes: actPausedMins,
      currentlyPausedDurationMinutes,
      liveAssessment,
    }
  }

  return {
    totalSessions,
    completedSessions,
    abandonedSessions,
    startTimings: {
      primaryWindow,
      breakdown: timeBreakdown,
      recentStartTimes,
    },
    pausePatterns: {
      totalPauses,
      avgPausesPerSession,
      totalPausedMinutes,
      avgPauseDurationMinutes,
      pauseFrequencyRisk,
      pauseFrequencyDescription,
      timingOfPauses: {
        earlyPausesCount,
        midLatePausesCount,
        diagnosticNote,
      },
      timeBreakdown: pauseTimeBreakdown,
      hourlyBreakdown,
      peakLagWindow,
    },
    activeSessionAnalysis,
  }
}

/**
 * Formats study pattern telemetry into an executive brief for the AI prompt.
 */
export function formatStudyPatternForPrompt(analysis: StudyPatternAnalysis): string {
  const { totalSessions, startTimings, pausePatterns, activeSessionAnalysis } = analysis

  let section = `═══ STUDY PATTERN & TIMER TELEMETRY (START TIMINGS, PAUSES & STAMINA) ═══\n`

  if (totalSessions === 0 && !activeSessionAnalysis) {
    section += `• No historical timer sessions logged yet.\n`
    return section
  }

  section += `• Sessions Analyzed: ${totalSessions} recent blocks (${analysis.completedSessions} completed, ${analysis.abandonedSessions} abandoned)\n`
  section += `• Starting Timing Habit: ${startTimings.primaryWindow}\n`
  section += `  - Schedule Distribution: Morning: ${startTimings.breakdown.morning}, Afternoon: ${startTimings.breakdown.afternoon}, Evening: ${startTimings.breakdown.evening}, Night: ${startTimings.breakdown.night}\n`
  if (startTimings.recentStartTimes.length > 0) {
    section += `  - Recent Start Times: ${startTimings.recentStartTimes.slice(0, 3).join(", ")}\n`
  }

  section += `• Pause Diagnostics & Frequency:\n`
  section += `  - Average Pauses per Session: ${pausePatterns.avgPausesPerSession} (Risk Level: ${pausePatterns.pauseFrequencyRisk})\n`
  section += `  - Average Pause Duration: ${pausePatterns.avgPauseDurationMinutes} min (Total pause time: ${pausePatterns.totalPausedMinutes}m)\n`
  section += `  - Pattern Evaluation: ${pausePatterns.pauseFrequencyDescription}\n`
  section += `  - Pause Timing Behavior: ${pausePatterns.timingOfPauses.diagnosticNote}\n`

  if (pausePatterns.peakLagWindow && pausePatterns.peakLagWindow.window !== "none") {
    const lag = pausePatterns.peakLagWindow
    section += `• Time-of-Day Lag Diagnostic (Lagging Hours):\n`
    section += `  - Peak Interruption Window: ${lag.label} (${lag.timeRange})\n`
    section += `  - Lag Severity: ${lag.lagSeverity} (${lag.pauseCount} pauses, ${lag.totalPausedMinutes}m lost, ${lag.percentageOfTotalPauses}% of all pauses)\n`
    section += `  - Disturbance Factor: ${lag.disturbanceSummary}\n`
    section += `  - Distracted State Factor: ${lag.distractedStateSummary}\n`
  }

  if (activeSessionAnalysis) {
    section += `• Live Active Timer Telemetry:\n`
    section += `  - Status: ${activeSessionAnalysis.status.toUpperCase()}\n`
    if (activeSessionAnalysis.startedAtFormatted) {
      section += `  - Started At: ${activeSessionAnalysis.startedAtFormatted}\n`
    }
    section += `  - Pauses Logged in Active Block: ${activeSessionAnalysis.pausesSoFar} (${activeSessionAnalysis.totalPausedMinutes}m total paused)\n`
    section += `  - Real-time Assessment: ${activeSessionAnalysis.liveAssessment}\n`
  }

  section += `\nAI MENTOR STUDY PATTERN DIRECTIVES:
1. PAUSE FREQUENCY DIAGNOSIS: If the student takes too many pauses (>= 3 per session or risk HIGH), explicitly address focus stamina. Ask what causes the pauses (phone distractions, boredom, hard problems) and recommend the 5-minute immersion rule or setting phones outside the room.
2. TIMING & CHRONOTYPE COACHING: Note when they start studying (e.g. late night vs morning). If they start late and pause often, note how sleep/circadian rhythm impacts analytical problem-solving.
3. STARTUP RESISTANCE AWARENESS: If early pauses (< 15 mins into session) are frequent, coach them on lowering activation energy for the first 10 minutes.
4. TIME-OF-DAY LAG COACHING: If the student asks about lagging at a specific time (e.g. afternoon or late night) or why they pause frequently:
   - For afternoon lag: Explain postprandial circadian dip + ambient noise. Advise 25m Pomodoros, active PYQ problem-solving instead of videos, and a 10m outdoor daylight walk.
   - For night lag: Explain sleep pressure and depleted willpower. Advise a 11:30 PM cutoff and shifting hard problem-solving to earlier in the day.
   - For morning lag: Explain warmup hesitation. Advise the 5-minute immersion rule and keeping phones outside the room.
5. If the student asks how they are studying or about their focus pattern, give specific data-driven feedback referencing their real start times, pause count, and session completion.`

  return section
}

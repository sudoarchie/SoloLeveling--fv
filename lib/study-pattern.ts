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

export interface PomodoroSessionData {
  id?: string
  preset?: string
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

  return {
    id: s.id,
    preset: s.preset || "25",
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

  normalized.forEach((s) => {
    totalPauses += s.pauseCount
    totalPausedSeconds += s.totalPausedSeconds

    // Inspect events for pause timing
    s.events.forEach((ev) => {
      if (ev.type === "pause") {
        if (typeof ev.elapsedSeconds === "number") {
          if (ev.elapsedSeconds < 15 * 60) {
            earlyPausesCount++
          } else if (ev.elapsedSeconds > 40 * 60) {
            midLatePausesCount++
          }
        }
      }
    })
  })

  const avgPausesPerSession = totalSessions > 0 ? Number((totalPauses / totalSessions).toFixed(1)) : 0
  const totalPausedMinutes = Math.round(totalPausedSeconds / 60)
  const avgPauseDurationMinutes =
    totalPauses > 0 ? Number(((totalPausedSeconds / totalPauses) / 60).toFixed(1)) : 0

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
4. If the student asks how they are studying or about their focus pattern, give specific data-driven feedback referencing their real start times, pause count, and session completion.`

  return section
}

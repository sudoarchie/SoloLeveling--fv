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
      d.includes("test paper")
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
  duration_minutes?: number
  durationMinutes?: number
  description?: string
  status?: string
  completed?: boolean
  exp_awarded?: number
  started_at?: string
  startedAt?: string
  ended_at?: string
  endedAt?: string
  pause_count?: number
  pauseCount?: number
  total_paused_seconds?: number
  totalPausedSeconds?: number
  last_pause_description?: string
  lastPauseDescription?: string
}

export interface StudyPatternAnalysis {
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  startTimings: {
    primaryWindow: string
    breakdown: {
      morning: number
      afternoon: number
      evening: number
      night: number
    }
  }
  pausePatterns: {
    totalPauses: number
    avgPausesPerSession: number
    totalPausedMinutes: number
    avgPauseDurationMinutes: number
    pauseFrequencyRisk: "HIGH" | "MODERATE" | "LOW"
    pauseFrequencyDescription: string
    peakLagWindow?: {
      window: string
      label: string
      timeRange: string
      pauseCount: number
      totalPausedMinutes: number
      lagSeverity: "HIGH" | "MODERATE" | "LOW"
      disturbanceSummary: string
    }
  }
}

export function analyzeStudyPatterns(sessions: PomodoroSessionData[] = []): StudyPatternAnalysis {
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s) => s.completed || s.status === "completed").length
  const abandonedSessions = sessions.filter((s) => s.status === "abandoned").length

  const timeBreakdown = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  let totalPauses = 0
  let totalPausedSeconds = 0

  for (const s of sessions) {
    const rawStart = s.started_at || s.startedAt
    if (rawStart) {
      try {
        const d = new Date(rawStart)
        const hour = d.getHours()
        if (hour >= 5 && hour < 12) timeBreakdown.morning++
        else if (hour >= 12 && hour < 17) timeBreakdown.afternoon++
        else if (hour >= 17 && hour < 21) timeBreakdown.evening++
        else timeBreakdown.night++
      } catch {}
    }

    const pauses = s.pause_count ?? s.pauseCount ?? 0
    totalPauses += pauses
    totalPausedSeconds += s.total_paused_seconds ?? s.totalPausedSeconds ?? 0
  }

  let primaryWindow = "Balanced"
  const max = Math.max(timeBreakdown.morning, timeBreakdown.afternoon, timeBreakdown.evening, timeBreakdown.night)
  if (max > 0) {
    if (timeBreakdown.morning === max) primaryWindow = "Morning Focus (05:00 - 12:00)"
    else if (timeBreakdown.afternoon === max) primaryWindow = "Afternoon Heavy (12:00 - 17:00)"
    else if (timeBreakdown.evening === max) primaryWindow = "Evening Deep Work (17:00 - 21:00)"
    else primaryWindow = "Late Night / Nocturnal (21:00 - 05:00)"
  }

  const avgPauses = totalSessions > 0 ? Number((totalPauses / totalSessions).toFixed(1)) : 0
  const totalPausedMinutes = Math.round(totalPausedSeconds / 60)
  const avgPauseDuration = totalPauses > 0 ? Number((totalPausedMinutes / totalPauses).toFixed(1)) : 0

  let pauseFrequencyRisk: "HIGH" | "MODERATE" | "LOW" = "LOW"
  let pauseFrequencyDescription = "Elite deep focus flow. Minimal interruptions during timer intervals."
  if (avgPauses >= 2.5) {
    pauseFrequencyRisk = "HIGH"
    pauseFrequencyDescription = "High interruption risk. Frequent pauses disrupt cognitive deep work."
  } else if (avgPauses >= 1.2) {
    pauseFrequencyRisk = "MODERATE"
    pauseFrequencyDescription = "Moderate pause frequency. Recommend 5-minute phone-away rule."
  }

  return {
    totalSessions,
    completedSessions,
    abandonedSessions,
    startTimings: {
      primaryWindow,
      breakdown: timeBreakdown,
    },
    pausePatterns: {
      totalPauses,
      avgPausesPerSession: avgPauses,
      totalPausedMinutes,
      avgPauseDurationMinutes: avgPauseDuration,
      pauseFrequencyRisk,
      pauseFrequencyDescription,
    },
  }
}

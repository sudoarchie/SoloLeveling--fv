"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { format, isSameDay } from "date-fns"
import { analyzeStudyPatterns, type TimerEvent, type FocusType, normalizeFocusType } from "@/lib/study-pattern"

export type PomodoroPreset = "25" | "90" | "180" | "custom"
export type PomodoroStatus = "idle" | "running" | "paused" | "completed"
export type PomodoroMode = "work" | "break"
export type { TimerEvent, FocusType } from "@/lib/study-pattern"

export interface PomodoroSessionRecord {
  id: string
  preset: PomodoroPreset
  focusType?: FocusType
  durationMinutes: number
  description: string
  completedAt: string
  expAwarded: number
  startedAt?: string
  pauseCount?: number
  totalPausedSeconds?: number
  actualFocusSeconds?: number
  status?: "completed" | "abandoned" | "running" | "paused"
  lastPauseDescription?: string
  events?: TimerEvent[]
}

interface StoredPomodoroState {
  preset: PomodoroPreset
  customMinutes: number
  description: string
  focusType?: FocusType
  mode: PomodoroMode
  status: PomodoroStatus
  targetEndTime: number | null
  pausedTimeLeft: number | null
  durationMinutes: number
  activeSessionId?: string | null
  startedAt?: string | null
  pauseCount?: number
  totalPausedSeconds?: number
  lastPausedAt?: string | null
  pauseDescription?: string
  events?: TimerEvent[]
}

const STORAGE_KEY_STATE = "gate_tracker_pomodoro_state_v2"
const STORAGE_KEY_HISTORY = "gate_tracker_pomodoro_history_v2"

export const DEFAULT_SEEDED_SESSIONS: PomodoroSessionRecord[] = [
  {
    id: "pomodoro-seed-1",
    preset: "180",
    focusType: "lecture",
    durationMinutes: 180,
    description:
      "cn lecture Videos 5–7 | GATE 2016–2018 Layer Functions & Headers OSI & TCP/IP Reference Models, Layering Architecture & Encapsulation",
    completedAt: "2026-10-20T16:09:00.000Z",
    startedAt: "2026-10-20T13:00:00.000Z",
    pauseCount: 1,
    totalPausedSeconds: 540,
    expAwarded: 250,
    status: "completed",
  },
  {
    id: "pomodoro-seed-2",
    preset: "180",
    focusType: "practice",
    durationMinutes: 180,
    description: "Operating Systems & Computer Networks Deep Focus Block",
    completedAt: "2026-10-20T14:15:00.000Z",
    startedAt: "2026-10-20T11:15:00.000Z",
    pauseCount: 2,
    totalPausedSeconds: 600,
    expAwarded: 250,
    status: "completed",
  },
  {
    id: "pomodoro-seed-3",
    preset: "90",
    focusType: "practice",
    durationMinutes: 90,
    description: "DSA & Algorithms Problem Practice",
    completedAt: "2026-10-20T11:45:00.000Z",
    startedAt: "2026-10-20T10:15:00.000Z",
    pauseCount: 0,
    totalPausedSeconds: 0,
    expAwarded: 120,
    status: "completed",
  },
  {
    id: "pomodoro-seed-4",
    preset: "25",
    focusType: "revision",
    durationMinutes: 25,
    description: "Revision dsa notes",
    completedAt: "2026-10-20T12:21:00.000Z",
    startedAt: "2026-10-20T11:55:00.000Z",
    pauseCount: 0,
    totalPausedSeconds: 0,
    expAwarded: 30,
    status: "completed",
  },
  {
    id: "pomodoro-seed-5",
    preset: "25",
    focusType: "revision",
    durationMinutes: 25,
    description: "Revision dsa notes - Quick recall",
    completedAt: "2026-10-20T10:15:00.000Z",
    startedAt: "2026-10-20T09:50:00.000Z",
    pauseCount: 1,
    totalPausedSeconds: 120,
    expAwarded: 30,
    status: "completed",
  },
  {
    id: "pomodoro-seed-6",
    preset: "90",
    focusType: "revision",
    durationMinutes: 25,
    description: "Revision dsa notes & PYQ review",
    completedAt: "2026-10-20T09:38:00.000Z",
    startedAt: "2026-10-20T09:12:00.000Z",
    pauseCount: 0,
    totalPausedSeconds: 0,
    expAwarded: 30,
    status: "completed",
  },
  {
    id: "pomodoro-seed-7",
    preset: "25",
    focusType: "revision",
    durationMinutes: 25,
    description: "Formula review & concepts",
    completedAt: "2026-10-20T08:30:00.000Z",
    startedAt: "2026-10-20T08:05:00.000Z",
    pauseCount: 0,
    totalPausedSeconds: 0,
    expAwarded: 30,
    status: "completed",
  },
  {
    id: "pomodoro-seed-8",
    preset: "180",
    focusType: "mock_test",
    durationMinutes: 180,
    description: "GATE CS Full Mock Exam 1 (Closed Book Simulation)",
    completedAt: "2026-10-19T17:00:00.000Z",
    startedAt: "2026-10-19T14:00:00.000Z",
    pauseCount: 0,
    totalPausedSeconds: 0,
    expAwarded: 250,
    status: "completed",
  },
]

// Synthesize pleasant completion chime via Web Audio API
function playCompletionChime() {
  if (typeof window === "undefined") return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const startTime = ctx.currentTime + idx * 0.14
      const stopTime = startTime + 0.35

      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(stopTime)
    })
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

function getPresetMinutes(preset: PomodoroPreset, customMinutes: number): number {
  switch (preset) {
    case "25":
      return 25
    case "90":
      return 90
    case "180":
      return 180
    case "custom":
      return Math.max(1, Math.min(360, customMinutes))
  }
}

function getBreakMinutes(durationMinutes: number): number {
  if (durationMinutes <= 25) return 5
  if (durationMinutes <= 90) return 15
  return 30
}

function calculateExp(durationMinutes: number): number {
  if (durationMinutes <= 25) return 30
  if (durationMinutes <= 90) return 120
  if (durationMinutes <= 180) return 250
  return Math.max(10, Math.round(durationMinutes * 1.3))
}

export function usePomodoro() {
  const [preset, setPresetState] = useState<PomodoroPreset>("180")
  const [customMinutes, setCustomMinutesState] = useState<number>(45)
  const [description, setDescriptionState] = useState<string>(
    "cn lecture Videos 5–7 | GATE 2016–2018 Layer Functions & Headers OSI & TCP/IP Reference Models, Layering Architecture & Encapsulation",
  )
  const [focusType, setFocusTypeState] = useState<FocusType>("lecture")
  const [mode, setModeState] = useState<PomodoroMode>("work")
  const [status, setStatusState] = useState<PomodoroStatus>("idle")
  const [timeLeft, setTimeLeft] = useState<number>(180 * 60)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null)
  const [history, setHistory] = useState<PomodoroSessionRecord[]>(DEFAULT_SEEDED_SESSIONS)

  // Live timer telemetry fields (persisted to DB & AI)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [pauseCount, setPauseCount] = useState<number>(0)
  const [totalPausedSeconds, setTotalPausedSeconds] = useState<number>(0)
  const [lastPausedAt, setLastPausedAt] = useState<string | null>(null)
  const [pauseDescription, setPauseDescriptionState] = useState<string>("")
  const [events, setEvents] = useState<TimerEvent[]>([])

  const stateRef = useRef({
    preset,
    customMinutes,
    description,
    focusType,
    mode,
    status,
    targetEndTime,
    timeLeft,
    activeSessionId,
    startedAt,
    pauseCount,
    totalPausedSeconds,
    lastPausedAt,
    pauseDescription,
    events,
  })

  // Synchronize ref
  stateRef.current = {
    preset,
    customMinutes,
    description,
    focusType,
    mode,
    status,
    targetEndTime,
    timeLeft,
    activeSessionId,
    startedAt,
    pauseCount,
    totalPausedSeconds,
    lastPausedAt,
    pauseDescription,
    events,
  }

  // Load history & state from localStorage on initial client mount, plus sync remote history
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY)
      if (rawHistory) {
        const parsed: PomodoroSessionRecord[] = JSON.parse(rawHistory)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((p) => p.id || p.description + p.completedAt))
          const missingSeeds = DEFAULT_SEEDED_SESSIONS.filter(
            (s) => !existingIds.has(s.id) && !existingIds.has(s.description + s.completedAt),
          )
          const merged = [...parsed, ...missingSeeds].slice(0, 50)
          setHistory(merged)
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged))
        } else {
          setHistory(DEFAULT_SEEDED_SESSIONS)
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(DEFAULT_SEEDED_SESSIONS))
        }
      } else {
        setHistory(DEFAULT_SEEDED_SESSIONS)
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(DEFAULT_SEEDED_SESSIONS))
      }
    } catch {
      setHistory(DEFAULT_SEEDED_SESSIONS)
    }

    try {
      const rawState = localStorage.getItem(STORAGE_KEY_STATE)
      if (rawState) {
        const parsed: StoredPomodoroState = JSON.parse(rawState)
        setPresetState(parsed.preset || "180")
        setCustomMinutesState(parsed.customMinutes || 45)
        setDescriptionState(
          parsed.description ||
            "cn lecture Videos 5–7 | GATE 2016–2018 Layer Functions & Headers OSI & TCP/IP Reference Models, Layering Architecture & Encapsulation",
        )
        if (parsed.focusType) setFocusTypeState(parsed.focusType)
        setModeState(parsed.mode || "work")

        if (parsed.activeSessionId) setActiveSessionId(parsed.activeSessionId)
        if (parsed.startedAt) setStartedAt(parsed.startedAt)
        if (typeof parsed.pauseCount === "number") setPauseCount(parsed.pauseCount)
        if (typeof parsed.totalPausedSeconds === "number") setTotalPausedSeconds(parsed.totalPausedSeconds)
        if (parsed.lastPausedAt) setLastPausedAt(parsed.lastPausedAt)
        if (parsed.pauseDescription) setPauseDescriptionState(parsed.pauseDescription)
        if (Array.isArray(parsed.events)) setEvents(parsed.events)

        if (parsed.status === "running" && parsed.targetEndTime) {
          const remaining = Math.max(0, Math.ceil((parsed.targetEndTime - Date.now()) / 1000))
          if (remaining > 0) {
            setStatusState("running")
            setTargetEndTime(parsed.targetEndTime)
            setTimeLeft(remaining)
          } else {
            setStatusState("completed")
            setTimeLeft(0)
            setTargetEndTime(null)
          }
        } else if (parsed.status === "paused" && parsed.pausedTimeLeft) {
          setStatusState("paused")
          setTimeLeft(parsed.pausedTimeLeft)
          setTargetEndTime(null)
        } else {
          setStatusState("idle")
          const totalMins =
            parsed.mode === "break"
              ? getBreakMinutes(parsed.durationMinutes || 25)
              : getPresetMinutes(parsed.preset || "25", parsed.customMinutes || 45)
          setTimeLeft(totalMins * 60)
          setTargetEndTime(null)
        }
      }
    } catch {
      // Ignore
    }

    // Remote history synchronization with Supabase
    const loadRemoteSessions = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: remoteData, error } = await supabase
          .from("pomodoro_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(50)

        if (!error && Array.isArray(remoteData) && remoteData.length > 0) {
          const remoteRecords: PomodoroSessionRecord[] = remoteData.map((row: any) => {
            const eventFocusType = Array.isArray(row.events)
              ? row.events.find((e: any) => e.focusType)?.focusType
              : undefined
            const detectedFocusType = normalizeFocusType(row.focus_type || eventFocusType, row.description)
            return {
              id: row.id,
              preset: (row.preset as PomodoroPreset) || "25",
              focusType: detectedFocusType,
              durationMinutes: row.duration_minutes,
              description: row.description || "Focus block",
              completedAt: row.ended_at || row.started_at,
              expAwarded: row.exp_awarded || 0,
              startedAt: row.started_at,
              pauseCount: row.pause_count || 0,
              totalPausedSeconds: row.total_paused_seconds || 0,
              actualFocusSeconds: row.actual_focus_seconds || 0,
              status: row.status,
              events: Array.isArray(row.events) ? row.events : [],
            }
          })

          setHistory((prev) => {
            const map = new Map<string, PomodoroSessionRecord>()
            prev.forEach((p) => map.set(p.id, p))
            remoteRecords.forEach((r) => map.set(r.id, r))
            const merged = Array.from(map.values())
              .sort(
                (a, b) =>
                  new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime(),
              )
              .slice(0, 50)
            try {
              localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged))
            } catch {}
            return merged
          })
        }
      } catch (err) {
        console.warn("Could not load remote pomodoro sessions:", err)
      }
    }

    void loadRemoteSessions()
  }, [])

  // Auto-verify and reconcile today's focus EXP with PostgreSQL on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false

    const syncTodayFocusExp = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const todayStr = format(new Date(), "yyyy-MM-dd")
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY)
        const parsed: PomodoroSessionRecord[] = rawHistory
          ? JSON.parse(rawHistory)
          : DEFAULT_SEEDED_SESSIONS
        if (!Array.isArray(parsed)) return

        const todaySes = parsed.filter(
          (h) =>
            !h.id?.startsWith("pomodoro-seed-") &&
            h.completedAt &&
            isSameDay(new Date(h.completedAt), new Date()),
        )
        const todayExp = todaySes.reduce((acc, s) => acc + (s.expAwarded || 0), 0)
        const todayMins = todaySes.reduce((acc, s) => acc + (s.durationMinutes || 0), 0)
        const todayHours = Number((todayMins / 60).toFixed(1))

        if (todayExp <= 0) return

        const { data: todayReport } = await supabase
          .from("daily_reports")
          .select("*")
          .eq("user_id", user.id)
          .eq("report_date", todayStr)
          .maybeSingle()

        if (!todayReport) {
          await supabase.from("daily_reports").insert({
            user_id: user.id,
            report_date: todayStr,
            practice_hours: todayHours,
            exp_gained: todayExp,
            lectures_completed: 0,
            topics_revised: 0,
            morning_session: false,
            exercise_done: false,
            distractions_level: "None",
          })
          const { data: prog } = await supabase
            .from("user_progress")
            .select("current_exp")
            .eq("user_id", user.id)
            .maybeSingle()
          await supabase
            .from("user_progress")
            .update({
              current_exp: (prog?.current_exp ?? 0) + todayExp,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
          window.dispatchEvent(new CustomEvent("user-progress-changed"))
        } else if ((todayReport.exp_gained || 0) < todayExp) {
          const deficit = todayExp - (todayReport.exp_gained || 0)
          const nextExp = (todayReport.exp_gained || 0) + deficit
          const nextHours = Math.max(Number(todayReport.practice_hours || 0), todayHours)
          await supabase
            .from("daily_reports")
            .update({
              exp_gained: nextExp,
              practice_hours: nextHours,
              updated_at: new Date().toISOString(),
            })
            .eq("id", todayReport.id)

          const { data: prog } = await supabase
            .from("user_progress")
            .select("current_exp")
            .eq("user_id", user.id)
            .maybeSingle()
          await supabase
            .from("user_progress")
            .update({
              current_exp: (prog?.current_exp ?? 0) + deficit,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
          window.dispatchEvent(new CustomEvent("user-progress-changed"))
        }
      } catch (err) {
        console.warn("Pomodoro auto-sync check notice:", err)
      }
    }

    void syncTodayFocusExp()
    return () => {
      cancelled = true
    }
  }, [])

  // Sync across tabs / window events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_STATE && e.newValue) {
        try {
          const parsed: StoredPomodoroState = JSON.parse(e.newValue)
          setPresetState(parsed.preset)
          setCustomMinutesState(parsed.customMinutes)
          setDescriptionState(parsed.description)
          setModeState(parsed.mode)
          setStatusState(parsed.status)
          if (parsed.activeSessionId !== undefined) setActiveSessionId(parsed.activeSessionId)
          if (parsed.startedAt !== undefined) setStartedAt(parsed.startedAt)
          if (typeof parsed.pauseCount === "number") setPauseCount(parsed.pauseCount)
          if (typeof parsed.totalPausedSeconds === "number") setTotalPausedSeconds(parsed.totalPausedSeconds)
          if (parsed.lastPausedAt !== undefined) setLastPausedAt(parsed.lastPausedAt)
          if (parsed.pauseDescription !== undefined) setPauseDescriptionState(parsed.pauseDescription)
          if (Array.isArray(parsed.events)) setEvents(parsed.events)

          if (parsed.status === "running" && parsed.targetEndTime) {
            setTimeLeft(Math.max(0, Math.ceil((parsed.targetEndTime - Date.now()) / 1000)))
            setTargetEndTime(parsed.targetEndTime)
          } else if (parsed.status === "paused" && parsed.pausedTimeLeft) {
            setTimeLeft(parsed.pausedTimeLeft)
            setTargetEndTime(null)
          }
        } catch {
          // Ignore
        }
      } else if (e.key === STORAGE_KEY_HISTORY && e.newValue) {
        try {
          setHistory(JSON.parse(e.newValue))
        } catch {
          // Ignore
        }
      }
    }

    const handleCustomSync = () => {
      try {
        const rawState = localStorage.getItem(STORAGE_KEY_STATE)
        if (rawState) {
          const parsed: StoredPomodoroState = JSON.parse(rawState)
          setPresetState(parsed.preset)
          setCustomMinutesState(parsed.customMinutes)
          setDescriptionState(parsed.description)
          setModeState(parsed.mode)
          setStatusState(parsed.status)
          if (parsed.activeSessionId !== undefined) setActiveSessionId(parsed.activeSessionId)
          if (parsed.startedAt !== undefined) setStartedAt(parsed.startedAt)
          if (typeof parsed.pauseCount === "number") setPauseCount(parsed.pauseCount)
          if (typeof parsed.totalPausedSeconds === "number") setTotalPausedSeconds(parsed.totalPausedSeconds)
          if (parsed.lastPausedAt !== undefined) setLastPausedAt(parsed.lastPausedAt)
          if (parsed.pauseDescription !== undefined) setPauseDescriptionState(parsed.pauseDescription)
          if (Array.isArray(parsed.events)) setEvents(parsed.events)

          if (parsed.status === "running" && parsed.targetEndTime) {
            setTimeLeft(Math.max(0, Math.ceil((parsed.targetEndTime - Date.now()) / 1000)))
            setTargetEndTime(parsed.targetEndTime)
          }
        }
      } catch {
        // Ignore
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("pomodoro-state-changed", handleCustomSync)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("pomodoro-state-changed", handleCustomSync)
    }
  }, [])

  // Persist state to localStorage & broadcast event
  const persistState = useCallback(
    (patch: Partial<StoredPomodoroState>) => {
      if (typeof window === "undefined") return
      const current = stateRef.current
      const durationMins =
        current.mode === "break"
          ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
          : getPresetMinutes(current.preset, current.customMinutes)

      const state: StoredPomodoroState = {
        preset: patch.preset ?? current.preset,
        customMinutes: patch.customMinutes ?? current.customMinutes,
        description: patch.description ?? current.description,
        focusType: patch.focusType !== undefined ? patch.focusType : current.focusType,
        mode: patch.mode ?? current.mode,
        status: patch.status ?? current.status,
        targetEndTime: patch.targetEndTime !== undefined ? patch.targetEndTime : current.targetEndTime,
        pausedTimeLeft: patch.pausedTimeLeft !== undefined ? patch.pausedTimeLeft : current.timeLeft,
        durationMinutes: patch.durationMinutes ?? durationMins,
        activeSessionId:
          patch.activeSessionId !== undefined ? patch.activeSessionId : current.activeSessionId,
        startedAt: patch.startedAt !== undefined ? patch.startedAt : current.startedAt,
        pauseCount: patch.pauseCount !== undefined ? patch.pauseCount : current.pauseCount,
        totalPausedSeconds:
          patch.totalPausedSeconds !== undefined ? patch.totalPausedSeconds : current.totalPausedSeconds,
        lastPausedAt: patch.lastPausedAt !== undefined ? patch.lastPausedAt : current.lastPausedAt,
        pauseDescription:
          patch.pauseDescription !== undefined ? patch.pauseDescription : current.pauseDescription,
        events: patch.events !== undefined ? patch.events : current.events,
      }

      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state))
      window.dispatchEvent(new CustomEvent("pomodoro-state-changed"))
    },
    [],
  )

  // Save completed session to history and Supabase
  const logCompletedSession = useCallback(
    async (completedPreset: PomodoroPreset, mins: number, taskDesc: string) => {
      const current = stateRef.current
      const exp = calculateExp(mins)
      const completeTimestamp = new Date().toISOString()
      const sessionId =
        current.activeSessionId ||
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pomo_${Date.now()}`)
      const actualFocusSecs = Math.max(0, mins * 60 - current.totalPausedSeconds)

      const sessionFocusType = current.focusType || normalizeFocusType(null, taskDesc)
      const completeEvent: TimerEvent = {
        type: "complete",
        timestamp: completeTimestamp,
        elapsedSeconds: actualFocusSecs,
        note: sessionFocusType,
      }
      const finalEvents = [...current.events, completeEvent]

      const record: PomodoroSessionRecord = {
        id: sessionId,
        preset: completedPreset,
        focusType: sessionFocusType,
        durationMinutes: mins,
        description: taskDesc.trim() || "Deep study block",
        completedAt: completeTimestamp,
        expAwarded: exp,
        startedAt: current.startedAt || new Date(Date.now() - mins * 60 * 1000).toISOString(),
        pauseCount: current.pauseCount,
        totalPausedSeconds: current.totalPausedSeconds,
        actualFocusSeconds: actualFocusSecs,
        lastPauseDescription: current.pauseDescription?.trim() || undefined,
        events: finalEvents,
        status: "completed",
      }

      const updatedHistory = [record, ...history].slice(0, 50)
      setHistory(updatedHistory)
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory))

      // Clear active tracking states
      setActiveSessionId(null)
      setStartedAt(null)
      setPauseCount(0)
      setTotalPausedSeconds(0)
      setLastPausedAt(null)
      setPauseDescriptionState("")
      setEvents([])

      // Award EXP in user_progress & daily_reports
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          // 1. Fetch current EXP & update user_progress
          const { data: progressRow } = await supabase
            .from("user_progress")
            .select("current_exp")
            .eq("user_id", user.id)
            .maybeSingle()

          const nextExp = (progressRow?.current_exp ?? 0) + exp
          await supabase
            .from("user_progress")
            .update({ current_exp: nextExp, updated_at: new Date().toISOString() })
            .eq("user_id", user.id)

          // 2. Also update today's daily_reports (practice_hours & exp_gained)
          const todayStr = format(new Date(), "yyyy-MM-dd")
          const addedHours = Number((mins / 60).toFixed(1))

          const { data: todayReport } = await supabase
            .from("daily_reports")
            .select("*")
            .eq("user_id", user.id)
            .eq("report_date", todayStr)
            .maybeSingle()

          if (todayReport) {
            await supabase
              .from("daily_reports")
              .update({
                practice_hours: Number((Number(todayReport.practice_hours || 0) + addedHours).toFixed(1)),
                exp_gained: (todayReport.exp_gained || 0) + exp,
                updated_at: new Date().toISOString(),
              })
              .eq("id", todayReport.id)
          } else {
            await supabase.from("daily_reports").insert({
              user_id: user.id,
              report_date: todayStr,
              practice_hours: addedHours,
              exp_gained: exp,
              lectures_completed: 0,
              topics_revised: 0,
              morning_session: false,
              exercise_done: false,
              distractions_level: "None",
            })
          }

          // 3. Dispatch user-progress-changed event to sync all UI components & hooks
          window.dispatchEvent(new CustomEvent("user-progress-changed"))

          // 4. Upsert completed session into pomodoro_sessions
          try {
            await supabase.from("pomodoro_sessions").upsert({
              id: sessionId,
              user_id: user.id,
              preset: completedPreset,
              duration_minutes: mins,
              description: taskDesc.trim(),
              status: "completed",
              completed: true,
              exp_awarded: exp,
              started_at: record.startedAt,
              ended_at: completeTimestamp,
              pause_count: current.pauseCount,
              total_paused_seconds: current.totalPausedSeconds,
              actual_focus_seconds: actualFocusSecs,
              events: finalEvents,
            })

            try {
              await supabase.from("pomodoro_timer_events").insert({
                session_id: sessionId,
                user_id: user.id,
                event_type: "complete",
                created_at: completeTimestamp,
                time_left_seconds: 0,
              })
            } catch {}
          } catch (err) {
            console.warn("Failed to persist pomodoro session completion in DB:", err)
          }
        }
      } catch (err) {
        console.error("Failed to sync points to user_progress:", err)
      }

      toast.success(`Focus Block Completed! +${exp} EXP Earned`, {
        description: taskDesc.trim()
          ? `Finished: "${taskDesc.trim()}" (${mins} min)`
          : `Finished ${mins} min deep focus session!`,
      })
    },
    [history],
  )

  // Countdown timer effect
  useEffect(() => {
    if (status !== "running" || !targetEndTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((targetEndTime - now) / 1000))

      if (remaining <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        setStatusState("completed")
        setTargetEndTime(null)

        playCompletionChime()

        const current = stateRef.current
        const mins =
          current.mode === "break"
            ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
            : getPresetMinutes(current.preset, current.customMinutes)

        if (current.mode === "work") {
          void logCompletedSession(current.preset, mins, current.description)
        } else {
          toast.info("Break finished! Ready for the next focus sprint.", {
            description: "Pick your next goal and start the timer.",
          })
        }

        persistState({
          status: "completed",
          targetEndTime: null,
          pausedTimeLeft: 0,
        })
      } else {
        setTimeLeft(remaining)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [status, targetEndTime, logCompletedSession, persistState])

  // Timer actions
  const startTimer = useCallback(async () => {
    const current = stateRef.current
    const totalMins =
      current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)

    const seconds = totalMins * 60
    const end = Date.now() + seconds * 1000
    const newSessionId =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pomo_${Date.now()}`
    const startTimestamp = new Date().toISOString()
    const startEvent: TimerEvent = {
      type: "start",
      timestamp: startTimestamp,
      timeLeft: seconds,
    }

    setTimeLeft(seconds)
    setTargetEndTime(end)
    setStatusState("running")
    setActiveSessionId(newSessionId)
    setStartedAt(startTimestamp)
    setPauseCount(0)
    setTotalPausedSeconds(0)
    setLastPausedAt(null)
    setEvents([startEvent])

    persistState({
      status: "running",
      targetEndTime: end,
      pausedTimeLeft: seconds,
      activeSessionId: newSessionId,
      startedAt: startTimestamp,
      pauseCount: 0,
      totalPausedSeconds: 0,
      lastPausedAt: null,
      events: [startEvent],
    })

    // Record session start to Supabase in background
    if (current.mode === "work") {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase.from("pomodoro_sessions").insert({
            id: newSessionId,
            user_id: user.id,
            preset: current.preset,
            duration_minutes: totalMins,
            description: current.description.trim(),
            status: "running",
            completed: false,
            started_at: startTimestamp,
            pause_count: 0,
            total_paused_seconds: 0,
            events: [startEvent],
          })

          try {
            await supabase.from("pomodoro_timer_events").insert({
              session_id: newSessionId,
              user_id: user.id,
              event_type: "start",
              created_at: startTimestamp,
              time_left_seconds: seconds,
            })
          } catch {}
        }
      } catch (err) {
        console.warn("Failed to record timer start in DB:", err)
      }
    }
  }, [persistState])

  const setPauseDescription = useCallback(
    (desc: string) => {
      setPauseDescriptionState(desc)
      const current = stateRef.current
      current.pauseDescription = desc

      // If there is a pause event, attach this description to it
      let updatedEvents = current.events
      for (let i = updatedEvents.length - 1; i >= 0; i--) {
        if (updatedEvents[i].type === "pause") {
          updatedEvents = [
            ...updatedEvents.slice(0, i),
            { ...updatedEvents[i], pauseDescription: desc, note: desc },
            ...updatedEvents.slice(i + 1),
          ]
          break
        }
      }
      setEvents(updatedEvents)
      persistState({ pauseDescription: desc, events: updatedEvents })
    },
    [persistState],
  )

  const resumeTimer = useCallback(async () => {
    const current = stateRef.current
    const seconds = current.timeLeft > 0 ? current.timeLeft : 60
    const end = Date.now() + seconds * 1000
    const resumeTimestamp = new Date().toISOString()
    const pauseDuration = current.lastPausedAt
      ? Math.max(0, Math.round((Date.now() - new Date(current.lastPausedAt).getTime()) / 1000))
      : 0
    const nextTotalPaused = current.totalPausedSeconds + pauseDuration

    const activePauseDesc = current.pauseDescription?.trim() || ""

    // Update last pause event with final pause description
    let updatedEvents = current.events
    if (activePauseDesc) {
      for (let i = updatedEvents.length - 1; i >= 0; i--) {
        if (updatedEvents[i].type === "pause") {
          updatedEvents = [
            ...updatedEvents.slice(0, i),
            {
              ...updatedEvents[i],
              pauseDescription: activePauseDesc,
              note: activePauseDesc,
            },
            ...updatedEvents.slice(i + 1),
          ]
          break
        }
      }
    }

    const resumeEvent: TimerEvent = {
      type: "resume",
      timestamp: resumeTimestamp,
      pauseDurationSeconds: pauseDuration,
      timeLeft: seconds,
      pauseDescription: activePauseDesc || undefined,
      note: activePauseDesc || undefined,
    }
    const nextEvents = [...updatedEvents, resumeEvent]

    setTargetEndTime(end)
    setStatusState("running")
    setTotalPausedSeconds(nextTotalPaused)
    setLastPausedAt(null)
    setEvents(nextEvents)

    persistState({
      status: "running",
      targetEndTime: end,
      pausedTimeLeft: seconds,
      totalPausedSeconds: nextTotalPaused,
      lastPausedAt: null,
      pauseDescription: "", // Reset after resuming so next pause starts fresh
      events: nextEvents,
    })

    // Record timer resume to Supabase in background
    if (current.activeSessionId && current.mode === "work") {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from("pomodoro_sessions")
            .update({
              status: "running",
              total_paused_seconds: nextTotalPaused,
              last_resumed_at: resumeTimestamp,
              events: nextEvents,
            })
            .eq("id", current.activeSessionId)

          try {
            await supabase.from("pomodoro_timer_events").insert({
              session_id: current.activeSessionId,
              user_id: user.id,
              event_type: "resume",
              created_at: resumeTimestamp,
              time_left_seconds: seconds,
              pause_duration_seconds: pauseDuration,
              note: activePauseDesc || null,
            })
          } catch {}
        }
      } catch (err) {
        console.warn("Failed to record timer resume in DB:", err)
      }
    }
  }, [persistState])

  const pauseTimer = useCallback(async (initialReason?: string) => {
    const current = stateRef.current
    if (current.status !== "running" || !current.targetEndTime) return
    const remaining = Math.max(0, Math.ceil((current.targetEndTime - Date.now()) / 1000))
    const pauseTimestamp = new Date().toISOString()
    const nextPauseCount = current.pauseCount + 1
    const totalDurationSecs =
      (current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)) * 60
    const elapsedSeconds = Math.max(0, totalDurationSecs - remaining)

    const initialDesc = (initialReason || current.pauseDescription || "").trim()

    const pauseEvent: TimerEvent = {
      type: "pause",
      timestamp: pauseTimestamp,
      timeLeft: remaining,
      elapsedSeconds,
      pauseDescription: initialDesc || undefined,
      note: initialDesc || undefined,
    }
    const nextEvents = [...current.events, pauseEvent]

    setTargetEndTime(null)
    setTimeLeft(remaining)
    setStatusState("paused")
    setPauseCount(nextPauseCount)
    setLastPausedAt(pauseTimestamp)
    if (initialDesc) setPauseDescriptionState(initialDesc)
    setEvents(nextEvents)

    persistState({
      status: "paused",
      targetEndTime: null,
      pausedTimeLeft: remaining,
      pauseCount: nextPauseCount,
      lastPausedAt: pauseTimestamp,
      pauseDescription: initialDesc,
      events: nextEvents,
    })

    // Record pause to Supabase in background
    if (current.activeSessionId && current.mode === "work") {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from("pomodoro_sessions")
            .update({
              status: "paused",
              pause_count: nextPauseCount,
              last_paused_at: pauseTimestamp,
              events: nextEvents,
            })
            .eq("id", current.activeSessionId)

          try {
            await supabase.from("pomodoro_timer_events").insert({
              session_id: current.activeSessionId,
              user_id: user.id,
              event_type: "pause",
              created_at: pauseTimestamp,
              time_left_seconds: remaining,
              note: initialDesc || null,
            })
          } catch {}
        }
      } catch (err) {
        console.warn("Failed to record timer pause in DB:", err)
      }
    }
  }, [persistState])

  const resetTimer = useCallback(async () => {
    const current = stateRef.current
    const totalMins =
      current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)

    const seconds = totalMins * 60
    const elapsedSeconds = seconds - current.timeLeft

    // If session had started and was active/paused for >= 15s, record abandon in DB
    if (
      current.activeSessionId &&
      (current.status === "running" || current.status === "paused") &&
      elapsedSeconds >= 15 &&
      current.mode === "work"
    ) {
      const abandonTimestamp = new Date().toISOString()
      const abandonEvent: TimerEvent = {
        type: "abandon",
        timestamp: abandonTimestamp,
        elapsedSeconds,
      }
      const finalEvents = [...current.events, abandonEvent]

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from("pomodoro_sessions")
            .update({
              status: "abandoned",
              ended_at: abandonTimestamp,
              events: finalEvents,
            })
            .eq("id", current.activeSessionId)

          try {
            await supabase.from("pomodoro_timer_events").insert({
              session_id: current.activeSessionId,
              user_id: user.id,
              event_type: "abandon",
              created_at: abandonTimestamp,
              time_left_seconds: current.timeLeft,
            })
          } catch {}
        }
      } catch (err) {
        console.warn("Failed to mark session abandoned in DB:", err)
      }
    }

    setTimeLeft(seconds)
    setTargetEndTime(null)
    setStatusState("idle")
    setActiveSessionId(null)
    setStartedAt(null)
    setPauseCount(0)
    setTotalPausedSeconds(0)
    setLastPausedAt(null)
    setEvents([])

    persistState({
      status: "idle",
      targetEndTime: null,
      pausedTimeLeft: seconds,
      activeSessionId: null,
      startedAt: null,
      pauseCount: 0,
      totalPausedSeconds: 0,
      lastPausedAt: null,
      events: [],
    })
  }, [persistState])

  const finishEarly = useCallback(() => {
    const current = stateRef.current
    const totalMins =
      current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)

    const elapsedSeconds = totalMins * 60 - timeLeft
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    playCompletionChime()
    setStatusState("completed")
    setTargetEndTime(null)
    setTimeLeft(0)

    if (current.mode === "work" && elapsedSeconds >= 30) {
      void logCompletedSession(current.preset, elapsedMinutes, current.description)
    } else {
      toast.info("Session ended early (under 30s)")
    }

    persistState({
      status: "completed",
      targetEndTime: null,
      pausedTimeLeft: 0,
    })
  }, [timeLeft, logCompletedSession, persistState])

  const setPreset = useCallback(
    (newPreset: PomodoroPreset, newCustomMinutes?: number) => {
      setPresetState(newPreset)
      if (typeof newCustomMinutes === "number") {
        setCustomMinutesState(newCustomMinutes)
      }

      const mins = getPresetMinutes(newPreset, newCustomMinutes ?? customMinutes)
      const seconds = mins * 60

      setModeState("work")
      setStatusState("idle")
      setTargetEndTime(null)
      setTimeLeft(seconds)

      persistState({
        preset: newPreset,
        customMinutes: newCustomMinutes ?? customMinutes,
        mode: "work",
        status: "idle",
        targetEndTime: null,
        pausedTimeLeft: seconds,
        durationMinutes: mins,
      })
    },
    [customMinutes, persistState],
  )

  const setDescription = useCallback(
    (desc: string) => {
      setDescriptionState(desc)
      persistState({ description: desc })
    },
    [persistState],
  )

  const setFocusType = useCallback(
    (type: FocusType) => {
      setFocusTypeState(type)
      persistState({ focusType: type })
    },
    [persistState],
  )

  const setBreakMode = useCallback(
    (isBreak: boolean) => {
      const newMode = isBreak ? "break" : "work"
      setModeState(newMode)
      setStatusState("idle")
      setTargetEndTime(null)

      const baseMins = getPresetMinutes(preset, customMinutes)
      const mins = isBreak ? getBreakMinutes(baseMins) : baseMins
      const seconds = mins * 60

      setTimeLeft(seconds)
      persistState({
        mode: newMode,
        status: "idle",
        targetEndTime: null,
        pausedTimeLeft: seconds,
        durationMinutes: mins,
      })
    },
    [preset, customMinutes, persistState],
  )

  // Derived metrics
  const activeDurationMinutes =
    mode === "break"
      ? getBreakMinutes(getPresetMinutes(preset, customMinutes))
      : getPresetMinutes(preset, customMinutes)

  const totalSeconds = activeDurationMinutes * 60
  const progressPct =
    totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - timeLeft) / totalSeconds) * 100)) : 0

  const todaySessions = history.filter(
    (h) => h.completedAt && isSameDay(new Date(h.completedAt), new Date()),
  )
  const todayFocusMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0)
  const todayExpEarned = todaySessions.reduce((acc, s) => acc + s.expAwarded, 0)

  // Package active Pomodoro context & telemetry for AI Mentor
  const getActiveContextForAI = useCallback(() => {
    const current = stateRef.current
    const studyPattern = analyzeStudyPatterns(history, {
      status: current.status,
      startedAt: current.startedAt,
      pauseCount: current.pauseCount,
      totalPausedSeconds: current.totalPausedSeconds,
      lastPausedAt: current.lastPausedAt,
      events: current.events,
    })

    const pauseActivities: Array<{
      timestamp: string
      durationSeconds: number
      description: string
    }> = []

    for (let i = 0; i < current.events.length; i++) {
      const ev = current.events[i]
      if (ev.type === "pause" || ev.type === "resume") {
        const desc = ev.pauseDescription || ev.note
        if (desc && desc !== current.focusType) {
          pauseActivities.push({
            timestamp: ev.timestamp,
            durationSeconds: ev.pauseDurationSeconds || 0,
            description: desc,
          })
        }
      }
    }

    return {
      preset:
        preset === "25"
          ? "25m Sprint"
          : preset === "90"
            ? "90m Deep Work"
            : preset === "180"
              ? "3h Marathon"
              : `Custom ${customMinutes}m`,
      durationMinutes: activeDurationMinutes,
      description: description.trim(),
      status,
      timeLeftSeconds: timeLeft,
      activeSessionId: current.activeSessionId,
      startedAt: current.startedAt,
      pauseCount: current.pauseCount,
      totalPausedSeconds: current.totalPausedSeconds,
      lastPausedAt: current.lastPausedAt,
      currentPauseDescription: current.pauseDescription?.trim() || "",
      pauseActivities,
      events: current.events,
      studyPattern,
      completedTodayCount: todaySessions.length,
      recentSessions: todaySessions.slice(0, 5).map((s) => ({
        description: s.description,
        durationMinutes: s.durationMinutes,
        completedAt: s.completedAt,
        startedAt: s.startedAt,
        pauseCount: s.pauseCount ?? 0,
        totalPausedSeconds: s.totalPausedSeconds ?? 0,
        lastPauseDescription: s.lastPauseDescription,
      })),
    }
  }, [
    preset,
    customMinutes,
    activeDurationMinutes,
    description,
    status,
    timeLeft,
    todaySessions,
    history,
  ])

  return {
    preset,
    customMinutes,
    description,
    focusType,
    mode,
    status,
    timeLeft,
    progressPct,
    activeDurationMinutes,
    history,
    todaySessions,
    todayFocusMinutes,
    todayExpEarned,
    activeSessionId,
    startedAt,
    pauseCount,
    totalPausedSeconds,
    lastPausedAt,
    pauseDescription,
    setPauseDescription,
    events,
    startTimer,
    resumeTimer,
    pauseTimer,
    resetTimer,
    finishEarly,
    setPreset,
    setDescription,
    setFocusType,
    setBreakMode,
    getActiveContextForAI,
  }
}

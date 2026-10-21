"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { format, isSameDay } from "date-fns"

export type PomodoroPreset = "25" | "90" | "180" | "custom"
export type PomodoroStatus = "idle" | "running" | "paused" | "completed"
export type PomodoroMode = "work" | "break"

export interface PomodoroSessionRecord {
  id: string
  preset: PomodoroPreset
  durationMinutes: number
  description: string
  completedAt: string
  expAwarded: number
}

interface StoredPomodoroState {
  preset: PomodoroPreset
  customMinutes: number
  description: string
  mode: PomodoroMode
  status: PomodoroStatus
  targetEndTime: number | null
  pausedTimeLeft: number | null
  durationMinutes: number
}

const STORAGE_KEY_STATE = "gate_tracker_pomodoro_state_v2"
const STORAGE_KEY_HISTORY = "gate_tracker_pomodoro_history_v2"

export const DEFAULT_SEEDED_SESSIONS: PomodoroSessionRecord[] = [
  {
    id: "pomodoro-seed-1",
    preset: "180",
    durationMinutes: 180,
    description:
      "cn lecture Videos 5–7 | GATE 2016–2018 Layer Functions & Headers OSI & TCP/IP Reference Models, Layering Architecture & Encapsulation",
    completedAt: "2026-10-20T16:09:00.000Z",
    expAwarded: 250,
  },
  {
    id: "pomodoro-seed-2",
    preset: "180",
    durationMinutes: 180,
    description: "Operating Systems & Computer Networks Deep Focus Block",
    completedAt: "2026-10-20T14:15:00.000Z",
    expAwarded: 250,
  },
  {
    id: "pomodoro-seed-3",
    preset: "90",
    durationMinutes: 90,
    description: "DSA & Algorithms Problem Practice",
    completedAt: "2026-10-20T11:45:00.000Z",
    expAwarded: 120,
  },
  {
    id: "pomodoro-seed-4",
    preset: "25",
    durationMinutes: 25,
    description: "Revision dsa notes",
    completedAt: "2026-10-20T12:21:00.000Z",
    expAwarded: 30,
  },
  {
    id: "pomodoro-seed-5",
    preset: "25",
    durationMinutes: 25,
    description: "Revision dsa notes - Quick recall",
    completedAt: "2026-10-20T10:15:00.000Z",
    expAwarded: 30,
  },
  {
    id: "pomodoro-seed-6",
    preset: "90",
    durationMinutes: 25,
    description: "Revision dsa notes & PYQ review",
    completedAt: "2026-10-20T09:38:00.000Z",
    expAwarded: 30,
  },
  {
    id: "pomodoro-seed-7",
    preset: "25",
    durationMinutes: 25,
    description: "Formula review & concepts",
    completedAt: "2026-10-20T08:30:00.000Z",
    expAwarded: 30,
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
  const [mode, setModeState] = useState<PomodoroMode>("work")
  const [status, setStatusState] = useState<PomodoroStatus>("idle")
  const [timeLeft, setTimeLeft] = useState<number>(180 * 60)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null)
  const [history, setHistory] = useState<PomodoroSessionRecord[]>(DEFAULT_SEEDED_SESSIONS)

  const stateRef = useRef({
    preset,
    customMinutes,
    description,
    mode,
    status,
    targetEndTime,
    timeLeft,
  })

  // Synchronize ref
  stateRef.current = {
    preset,
    customMinutes,
    description,
    mode,
    status,
    targetEndTime,
    timeLeft,
  }

  // Load history & state from localStorage on initial client mount
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
        setModeState(parsed.mode || "work")

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
          (h) => !h.id?.startsWith("pomodoro-seed-") && h.completedAt && isSameDay(new Date(h.completedAt), new Date()),
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
          // If exp_gained is less than focus exp, reconcile the deficit
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
        mode: patch.mode ?? current.mode,
        status: patch.status ?? current.status,
        targetEndTime: patch.targetEndTime !== undefined ? patch.targetEndTime : current.targetEndTime,
        pausedTimeLeft: patch.pausedTimeLeft !== undefined ? patch.pausedTimeLeft : current.timeLeft,
        durationMinutes: patch.durationMinutes ?? durationMins,
      }

      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state))
      window.dispatchEvent(new CustomEvent("pomodoro-state-changed"))
    },
    [],
  )

  // Save completed session to history and Supabase
  const logCompletedSession = useCallback(
    async (completedPreset: PomodoroPreset, mins: number, taskDesc: string) => {
      const exp = calculateExp(mins)
      const record: PomodoroSessionRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        preset: completedPreset,
        durationMinutes: mins,
        description: taskDesc.trim() || "Deep study block",
        completedAt: new Date().toISOString(),
        expAwarded: exp,
      }

      const updatedHistory = [record, ...history].slice(0, 50)
      setHistory(updatedHistory)
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory))

      // Award EXP in user_progress (the single point table) & daily_reports
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

          // 4. Try inserting into pomodoro_sessions (graceful if table missing)
          try {
            await supabase.from("pomodoro_sessions").insert({
              user_id: user.id,
              preset: completedPreset,
              duration_minutes: mins,
              description: taskDesc.trim(),
              completed: true,
              exp_awarded: exp,
              started_at: new Date(Date.now() - mins * 60 * 1000).toISOString(),
              ended_at: new Date().toISOString(),
            })
          } catch {
            // Table might not exist yet before migration
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
  const startTimer = useCallback(() => {
    const current = stateRef.current
    const totalMins =
      current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)

    const seconds = totalMins * 60
    const end = Date.now() + seconds * 1000

    setTimeLeft(seconds)
    setTargetEndTime(end)
    setStatusState("running")

    persistState({
      status: "running",
      targetEndTime: end,
      pausedTimeLeft: seconds,
    })
  }, [persistState])

  const resumeTimer = useCallback(() => {
    const seconds = timeLeft > 0 ? timeLeft : 60
    const end = Date.now() + seconds * 1000

    setTargetEndTime(end)
    setStatusState("running")

    persistState({
      status: "running",
      targetEndTime: end,
      pausedTimeLeft: seconds,
    })
  }, [timeLeft, persistState])

  const pauseTimer = useCallback(() => {
    if (status !== "running" || !targetEndTime) return
    const remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))

    setTargetEndTime(null)
    setTimeLeft(remaining)
    setStatusState("paused")

    persistState({
      status: "paused",
      targetEndTime: null,
      pausedTimeLeft: remaining,
    })
  }, [status, targetEndTime, persistState])

  const resetTimer = useCallback(() => {
    const current = stateRef.current
    const totalMins =
      current.mode === "break"
        ? getBreakMinutes(getPresetMinutes(current.preset, current.customMinutes))
        : getPresetMinutes(current.preset, current.customMinutes)

    const seconds = totalMins * 60
    setTimeLeft(seconds)
    setTargetEndTime(null)
    setStatusState("idle")

    persistState({
      status: "idle",
      targetEndTime: null,
      pausedTimeLeft: seconds,
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

  // Package active Pomodoro context for AI Mentor
  const getActiveContextForAI = useCallback(() => {
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
      completedTodayCount: todaySessions.length,
      recentSessions: todaySessions.slice(0, 3).map((s) => ({
        description: s.description,
        durationMinutes: s.durationMinutes,
        completedAt: s.completedAt,
      })),
    }
  }, [preset, customMinutes, activeDurationMinutes, description, status, timeLeft, todaySessions])

  return {
    preset,
    customMinutes,
    description,
    mode,
    status,
    timeLeft,
    progressPct,
    activeDurationMinutes,
    history,
    todaySessions,
    todayFocusMinutes,
    todayExpEarned,
    startTimer,
    resumeTimer,
    pauseTimer,
    resetTimer,
    finishEarly,
    setPreset,
    setDescription,
    setBreakMode,
    getActiveContextForAI,
  }
}

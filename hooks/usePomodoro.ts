"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

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
  const [preset, setPresetState] = useState<PomodoroPreset>("25")
  const [customMinutes, setCustomMinutesState] = useState<number>(45)
  const [description, setDescriptionState] = useState<string>("")
  const [mode, setModeState] = useState<PomodoroMode>("work")
  const [status, setStatusState] = useState<PomodoroStatus>("idle")
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60)
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null)
  const [history, setHistory] = useState<PomodoroSessionRecord[]>([])

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
        setHistory(JSON.parse(rawHistory))
      }
    } catch {
      // Ignore parse errors
    }

    try {
      const rawState = localStorage.getItem(STORAGE_KEY_STATE)
      if (rawState) {
        const parsed: StoredPomodoroState = JSON.parse(rawState)
        setPresetState(parsed.preset || "25")
        setCustomMinutesState(parsed.customMinutes || 45)
        setDescriptionState(parsed.description || "")
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

      // Award EXP in user_progress
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          // 1. Fetch current EXP & update
          const { data: progressRow } = await supabase
            .from("user_progress")
            .select("current_exp")
            .eq("user_id", user.id)
            .single()

          const nextExp = (progressRow?.current_exp ?? 0) + exp
          await supabase
            .from("user_progress")
            .update({ current_exp: nextExp })
            .eq("user_id", user.id)

          window.dispatchEvent(new CustomEvent("user-progress-changed"))

          // 2. Try inserting into pomodoro_sessions (graceful if table missing)
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
      } catch {
        // Continue even if Supabase offline
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

    if (current.mode === "work" && elapsedMinutes >= 3) {
      void logCompletedSession(current.preset, elapsedMinutes, current.description)
    } else {
      toast.info("Session ended early")
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

  const todayStr = new Date().toISOString().split("T")[0]
  const todaySessions = history.filter((h) => h.completedAt.startsWith(todayStr))
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

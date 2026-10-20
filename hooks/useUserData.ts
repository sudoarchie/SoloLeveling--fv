"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import { createClient } from "@/utils/supabase/client"

export interface DailyReport {
  date: Date
  lecturesCompleted: number
  topicsRevised: number
  practiceHours: number
  morningSession: boolean
  exerciseDone: boolean
  distractionsLevel: string
  mentalState: string
  expGained: number
}

export interface UserProgress {
  currentExp: number
  examDate: Date | null
  soundEnabled: boolean
  selectedTheme: string
  unlockedTitles: string[]
  activeTitle: string | null
  unlockedCosmetics: string[]
  plan: "free" | "pro"
  customPrompt: string
}

const DEFAULT_PROGRESS: UserProgress = {
  currentExp: 0,
  examDate: null,
  soundEnabled: true,
  selectedTheme: "blue",
  unlockedTitles: [],
  activeTitle: null,
  unlockedCosmetics: [],
  plan: "free",
  customPrompt: "",
}

function progressFromRow(row: any): UserProgress {
  return {
    currentExp: row.current_exp ?? 0,
    examDate: row.exam_date ? new Date(`${row.exam_date}T00:00:00`) : null,
    soundEnabled: row.sound_enabled ?? true,
    selectedTheme: row.selected_theme ?? "blue",
    unlockedTitles: row.unlocked_titles ?? [],
    activeTitle: row.active_title ?? null,
    unlockedCosmetics: row.unlocked_cosmetics ?? [],
    plan: row.plan ?? "free",
    customPrompt: row.custom_prompt ?? "",
  }
}

/**
 * Replaces localStorage with Supabase persistence.
 * - user_progress: one row per user (EXP, settings, cosmetics)
 * - daily_reports: one row per user per day (daily entry form data)
 */
export function useUserData() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  // Mirror of progress for reliable functional updates (avoids stale closures)
  const progressRef = useRef<UserProgress>(DEFAULT_PROGRESS)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (!user) setLoading(false)
    })
  }, [supabase])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    // Load progress row (auto-created by signup trigger, but upsert as fallback)
    const { data: progressRow } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (progressRow) {
      const nextProgress = progressFromRow(progressRow)
      setProgress(nextProgress)
      progressRef.current = nextProgress
    } else {
      // Fallback for users created before the trigger existed
      await supabase.from("user_progress").upsert({ user_id: userId })
    }

    // Load last 30 days of reports
    const { data: reportRows } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", userId)
      .order("report_date", { ascending: false })
      .limit(30)

    if (reportRows) {
      setReports(
        reportRows.map((row: any) => ({
          date: new Date(`${row.report_date}T00:00:00`),
          lecturesCompleted: row.lectures_completed,
          topicsRevised: row.topics_revised,
          practiceHours: Number(row.practice_hours),
          morningSession: row.morning_session,
          exerciseDone: row.exercise_done,
          distractionsLevel: row.distractions_level,
          mentalState: row.mental_state ?? "",
          expGained: row.exp_gained,
        })),
      )
    }

    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (userId && !initialized.current) {
      initialized.current = true
      load()
    }
  }, [userId, load])

  useEffect(() => {
    const reloadProgress = async () => {
      if (!userId) return

      // 1. Reload single point table (user_progress)
      const { data } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
      if (data) {
        const nextProgress = progressFromRow(data)
        progressRef.current = nextProgress
        setProgress(nextProgress)
      }

      // 2. Reload daily reports so charts and stats sync immediately
      const { data: reportRows } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("user_id", userId)
        .order("report_date", { ascending: false })
        .limit(30)

      if (reportRows) {
        setReports(
          reportRows.map((row: any) => ({
            date: new Date(`${row.report_date}T00:00:00`),
            lecturesCompleted: row.lectures_completed,
            topicsRevised: row.topics_revised,
            practiceHours: Number(row.practice_hours),
            morningSession: row.morning_session,
            exerciseDone: row.exercise_done,
            distractionsLevel: row.distractions_level,
            mentalState: row.mental_state ?? "",
            expGained: row.exp_gained,
          })),
        )
      }
    }
    window.addEventListener("user-progress-changed", reloadProgress)
    return () => window.removeEventListener("user-progress-changed", reloadProgress)
  }, [supabase, userId])

  // Unified EXP awarding function: increments current_exp in user_progress
  // and updates today's daily_reports (practice_hours & exp_gained)
  const awardExp = useCallback(
    async (
      amount: number,
      options?: {
        practiceMinutes?: number
        source?: string
      },
    ) => {
      if (!userId || amount <= 0) return

      // 1. Fetch current EXP & update user_progress (the single point table)
      const { data: progressRow } = await supabase
        .from("user_progress")
        .select("current_exp")
        .eq("user_id", userId)
        .maybeSingle()

      const current = progressRow?.current_exp ?? progressRef.current.currentExp ?? 0
      const nextExp = current + amount

      await supabase
        .from("user_progress")
        .update({
          current_exp: nextExp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)

      progressRef.current = { ...progressRef.current, currentExp: nextExp }
      setProgress((prev) => ({ ...prev, currentExp: nextExp }))

      // 2. Sync to today's daily_reports
      const todayStr = format(new Date(), "yyyy-MM-dd")
      const addedHours = options?.practiceMinutes
        ? Number((options.practiceMinutes / 60).toFixed(1))
        : 0

      const { data: todayRow } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("report_date", todayStr)
        .maybeSingle()

      if (todayRow) {
        const nextPractice = Number(
          (Number(todayRow.practice_hours || 0) + addedHours).toFixed(1),
        )
        const nextGained = (todayRow.exp_gained || 0) + amount

        await supabase
          .from("daily_reports")
          .update({
            practice_hours: nextPractice,
            exp_gained: nextGained,
            updated_at: new Date().toISOString(),
          })
          .eq("id", todayRow.id)

        setReports((prev) =>
          prev.map((r) =>
            format(r.date, "yyyy-MM-dd") === todayStr
              ? { ...r, practiceHours: nextPractice, expGained: nextGained }
              : r,
          ),
        )
      } else {
        const newDaily = {
          user_id: userId,
          report_date: todayStr,
          practice_hours: addedHours,
          exp_gained: amount,
          lectures_completed: 0,
          topics_revised: 0,
          morning_session: false,
          exercise_done: false,
          distractions_level: "None",
        }
        await supabase.from("daily_reports").insert(newDaily)

        setReports((prev) => [
          {
            date: new Date(`${todayStr}T00:00:00`),
            lecturesCompleted: 0,
            topicsRevised: 0,
            practiceHours: addedHours,
            morningSession: false,
            exerciseDone: false,
            distractionsLevel: "None",
            mentalState: "",
            expGained: amount,
          },
          ...prev,
        ])
      }

      window.dispatchEvent(new CustomEvent("user-progress-changed"))
    },
    [supabase, userId],
  )

  // Persist progress. Accepts a partial patch or an updater function
  // (like setState) so rapid successive updates don't clobber each other.
  const saveProgress = useCallback(
    async (
      patch:
        | Partial<UserProgress>
        | ((prev: UserProgress) => Partial<UserProgress>),
    ) => {
      if (!userId) return

      // Resolve against the ref (always up-to-date), then update both ref and state
      const resolved =
        typeof patch === "function" ? patch(progressRef.current) : patch
      progressRef.current = { ...progressRef.current, ...resolved }
      setProgress(progressRef.current)

      const column: Record<keyof UserProgress, string> = {
        currentExp: "current_exp",
        examDate: "exam_date",
        soundEnabled: "sound_enabled",
        selectedTheme: "selected_theme",
        unlockedTitles: "unlocked_titles",
        activeTitle: "active_title",
        unlockedCosmetics: "unlocked_cosmetics",
        plan: "plan",
        customPrompt: "custom_prompt",
      }

      const update: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }
      for (const [key, value] of Object.entries(resolved)) {
        const col = column[key as keyof UserProgress]
        if (!col) continue
        if (col === "exam_date") {
          update[col] =
            value instanceof Date ? format(value, "yyyy-MM-dd") : value
        } else {
          update[col] = value
        }
      }

      await supabase.from("user_progress").update(update).eq("user_id", userId)
    },
    [supabase, userId],
  )

  // Upsert a daily report (replaces the report for that date or inserts new)
  const saveReport = useCallback(
    async (report: DailyReport) => {
      if (!userId) throw new Error("Sign in to save your report")

      const row = {
        user_id: userId,
        report_date: format(report.date, "yyyy-MM-dd"),
        lectures_completed: report.lecturesCompleted,
        topics_revised: report.topicsRevised,
        practice_hours: report.practiceHours,
        morning_session: report.morningSession,
        exercise_done: report.exerciseDone,
        distractions_level: report.distractionsLevel,
        mental_state: report.mentalState,
        exp_gained: report.expGained,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("daily_reports")
        .upsert(row, { onConflict: "user_id,report_date" })

      if (error) throw error

      {
        setReports((prev) => {
          const existingIndex = prev.findIndex(
            (r) => r.date.toDateString() === report.date.toDateString(),
          )
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = report
            return updated
          }
          return [report, ...prev].slice(0, 30)
        })
      }
    },
    [supabase, userId],
  )

  return {
    userId,
    progress,
    reports,
    loading,
    saveProgress,
    saveReport,
    awardExp,
    reload: load,
  }
}

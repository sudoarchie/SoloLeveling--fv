"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

/**
 * Replaces localStorage with Supabase persistence.
 * - user_progress: one row per user (EXP, settings, cosmetics)
 * - daily_reports: one row per user per day (daily entry form data)
 */
export function useUserData() {
  const supabase = createClient()
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
      setProgress({
        currentExp: progressRow.current_exp ?? 0,
        examDate: progressRow.exam_date
          ? new Date(`${progressRow.exam_date}T00:00:00`)
          : null,
        soundEnabled: progressRow.sound_enabled ?? true,
        selectedTheme: progressRow.selected_theme ?? "blue",
        unlockedTitles: progressRow.unlocked_titles ?? [],
        activeTitle: progressRow.active_title ?? null,
        unlockedCosmetics: progressRow.unlocked_cosmetics ?? [],
        plan: progressRow.plan ?? "free",
        customPrompt: progressRow.custom_prompt ?? "",
      })
      progressRef.current = {
        currentExp: progressRow.current_exp ?? 0,
        examDate: progressRow.exam_date
          ? new Date(`${progressRow.exam_date}T00:00:00`)
          : null,
        soundEnabled: progressRow.sound_enabled ?? true,
        selectedTheme: progressRow.selected_theme ?? "blue",
        unlockedTitles: progressRow.unlocked_titles ?? [],
        activeTitle: progressRow.active_title ?? null,
        unlockedCosmetics: progressRow.unlocked_cosmetics ?? [],
        plan: progressRow.plan ?? "free",
        customPrompt: progressRow.custom_prompt ?? "",
      }
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
    reload: load,
  }
}

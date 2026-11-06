"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format } from "date-fns"
import { createClient } from "@/utils/supabase/client"
import { enqueueSyncItem } from "@/lib/offline-sync"

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

const CACHE_PROGRESS_KEY = "gate_tracker_cached_progress"
const CACHE_REPORTS_KEY = "gate_tracker_cached_reports"
const CACHE_USER_ID_KEY = "gate_tracker_cached_user_id"

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

function saveLocalCache(progress: UserProgress, reports: DailyReport[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      CACHE_PROGRESS_KEY,
      JSON.stringify({
        ...progress,
        examDate: progress.examDate ? progress.examDate.toISOString() : null,
      })
    )
    localStorage.setItem(
      CACHE_REPORTS_KEY,
      JSON.stringify(
        reports.map((r) => ({
          ...r,
          date: r.date.toISOString(),
        }))
      )
    )
  } catch {}
}

function loadLocalCache(): { progress: UserProgress | null; reports: DailyReport[] | null } {
  if (typeof window === "undefined") return { progress: null, reports: null }
  try {
    const rawP = localStorage.getItem(CACHE_PROGRESS_KEY)
    let p: UserProgress | null = null
    if (rawP) {
      const parsed = JSON.parse(rawP)
      p = {
        ...parsed,
        examDate: parsed.examDate ? new Date(parsed.examDate) : null,
      }
    }
    const rawR = localStorage.getItem(CACHE_REPORTS_KEY)
    let r: DailyReport[] | null = null
    if (rawR) {
      const parsed = JSON.parse(rawR)
      if (Array.isArray(parsed)) {
        r = parsed.map((item: any) => ({
          ...item,
          date: new Date(item.date),
        }))
      }
    }
    return { progress: p, reports: r }
  } catch {
    return { progress: null, reports: null }
  }
}

/**
 * Replaces localStorage with Supabase persistence and offline sync.
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

  // Initialize from cache immediately to prevent blank screen when offline
  useEffect(() => {
    const cached = loadLocalCache()
    if (cached.progress) {
      setProgress(cached.progress)
      progressRef.current = cached.progress
    }
    if (cached.reports) {
      setReports(cached.reports)
    }
  }, [])

  useEffect(() => {
    // 1. Immediately read cached userId for offline support
    if (typeof window !== "undefined") {
      const cachedId = localStorage.getItem(CACHE_USER_ID_KEY)
      if (cachedId) {
        setUserId(cachedId)
      }
    }

    // 2. Check local session (works completely offline)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        if (typeof window !== "undefined") {
          localStorage.setItem(CACHE_USER_ID_KEY, session.user.id)
        }
      }
    }).catch(() => {})

    // 3. Verify with server if online
    if (typeof navigator === "undefined" || navigator.onLine) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUserId(user.id)
          if (typeof window !== "undefined") {
            localStorage.setItem(CACHE_USER_ID_KEY, user.id)
          }
        }
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [supabase])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    try {
      // Load progress row (auto-created by signup trigger, but upsert as fallback)
      const { data: progressRow, error: pError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      if (progressRow) {
        const nextProgress = progressFromRow(progressRow)
        setProgress(nextProgress)
        progressRef.current = nextProgress
      } else if (!pError) {
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
        const loadedReports: DailyReport[] = reportRows.map((row: any) => ({
          date: new Date(`${row.report_date}T00:00:00`),
          lecturesCompleted: row.lectures_completed,
          topicsRevised: row.topics_revised,
          practiceHours: Number(row.practice_hours),
          morningSession: row.morning_session,
          exerciseDone: row.exercise_done,
          distractionsLevel: row.distractions_level,
          mentalState: row.mental_state ?? "",
          expGained: row.exp_gained,
        }))
        setReports(loadedReports)
        saveLocalCache(progressRef.current, loadedReports)
      }
    } catch (err) {
      console.warn("[useUserData] Failed to load remote data (offline mode active):", err)
    } finally {
      setLoading(false)
    }
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

      try {
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
          const reloadedReports: DailyReport[] = reportRows.map((row: any) => ({
            date: new Date(`${row.report_date}T00:00:00`),
            lecturesCompleted: row.lectures_completed,
            topicsRevised: row.topics_revised,
            practiceHours: Number(row.practice_hours),
            morningSession: row.morning_session,
            exerciseDone: row.exercise_done,
            distractionsLevel: row.distractions_level,
            mentalState: row.mental_state ?? "",
            expGained: row.exp_gained,
          }))
          setReports(reloadedReports)
          saveLocalCache(progressRef.current, reloadedReports)
        }
      } catch {}
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

      const current = progressRef.current.currentExp ?? 0
      const nextExp = current + amount
      const nextProgressObj = { ...progressRef.current, currentExp: nextExp }

      // Optimistic update
      progressRef.current = nextProgressObj
      setProgress((prev) => ({ ...prev, currentExp: nextExp }))

      const todayStr = format(new Date(), "yyyy-MM-dd")
      const addedHours = options?.practiceMinutes
        ? Number((options.practiceMinutes / 60).toFixed(1))
        : 0

      let updatedReports: DailyReport[] = []
      const existingReportIndex = reports.findIndex(
        (r) => format(r.date, "yyyy-MM-dd") === todayStr
      )

      let targetPracticeHours = addedHours
      let targetExpGained = amount

      if (existingReportIndex >= 0) {
        const prevR = reports[existingReportIndex]
        targetPracticeHours = Number((Number(prevR.practiceHours || 0) + addedHours).toFixed(1))
        targetExpGained = (prevR.expGained || 0) + amount
        updatedReports = reports.map((r, i) =>
          i === existingReportIndex
            ? { ...r, practiceHours: targetPracticeHours, expGained: targetExpGained }
            : r
        )
      } else {
        const newDailyReport: DailyReport = {
          date: new Date(`${todayStr}T00:00:00`),
          lecturesCompleted: 0,
          topicsRevised: 0,
          practiceHours: addedHours,
          morningSession: false,
          exerciseDone: false,
          distractionsLevel: "None",
          mentalState: "",
          expGained: amount,
        }
        updatedReports = [newDailyReport, ...reports]
      }

      setReports(updatedReports)
      saveLocalCache(nextProgressObj, updatedReports)

      // Sync to backend or enqueue if offline / network error
      const isCurrentlyOnline = typeof navigator !== "undefined" && navigator.onLine

      if (!isCurrentlyOnline) {
        await enqueueSyncItem({
          table: "user_progress",
          action: "update",
          payload: { current_exp: nextExp, updated_at: new Date().toISOString() },
          matchCriteria: { user_id: userId },
          userId,
          description: `Level Up: +${amount} EXP (${options?.source || "Study"})`,
        })

        await enqueueSyncItem({
          table: "daily_reports",
          action: "upsert",
          payload: {
            user_id: userId,
            report_date: todayStr,
            practice_hours: targetPracticeHours,
            exp_gained: targetExpGained,
            lectures_completed: 0,
            topics_revised: 0,
            morning_session: false,
            exercise_done: false,
            distractions_level: "None",
            updated_at: new Date().toISOString(),
          },
          onConflict: "user_id,report_date",
          userId,
          description: `Daily Report EXP +${amount}`,
        })
        return
      }

      try {
        // 1. Update user_progress
        const { error: pErr } = await supabase
          .from("user_progress")
          .update({
            current_exp: nextExp,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)

        if (pErr) throw pErr

        // 2. Upsert daily_reports
        const { error: rErr } = await supabase
          .from("daily_reports")
          .upsert(
            {
              user_id: userId,
              report_date: todayStr,
              practice_hours: targetPracticeHours,
              exp_gained: targetExpGained,
              lectures_completed: 0,
              topics_revised: 0,
              morning_session: false,
              exercise_done: false,
              distractions_level: "None",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,report_date" }
          )

        if (rErr) throw rErr

        window.dispatchEvent(new CustomEvent("user-progress-changed"))
      } catch (err) {
        console.warn("[useUserData] Network failed on awardExp, enqueuing offline sync:", err)
        await enqueueSyncItem({
          table: "user_progress",
          action: "update",
          payload: { current_exp: nextExp, updated_at: new Date().toISOString() },
          matchCriteria: { user_id: userId },
          userId,
          description: `Level Up: +${amount} EXP (${options?.source || "Study"})`,
        })

        await enqueueSyncItem({
          table: "daily_reports",
          action: "upsert",
          payload: {
            user_id: userId,
            report_date: todayStr,
            practice_hours: targetPracticeHours,
            exp_gained: targetExpGained,
            lectures_completed: 0,
            topics_revised: 0,
            morning_session: false,
            exercise_done: false,
            distractions_level: "None",
            updated_at: new Date().toISOString(),
          },
          onConflict: "user_id,report_date",
          userId,
          description: `Daily Report EXP +${amount}`,
        })
      }
    },
    [reports, supabase, userId],
  )

  // Persist progress. Accepts a partial patch or an updater function
  const saveProgress = useCallback(
    async (
      patch:
        | Partial<UserProgress>
        | ((prev: UserProgress) => Partial<UserProgress>),
    ) => {
      if (!userId) return

      const resolved =
        typeof patch === "function" ? patch(progressRef.current) : patch
      progressRef.current = { ...progressRef.current, ...resolved }
      setProgress(progressRef.current)
      saveLocalCache(progressRef.current, reports)

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

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "user_progress",
          action: "update",
          payload: update,
          matchCriteria: { user_id: userId },
          userId,
          description: "Hunter Settings Update",
        })
        return
      }

      try {
        const { error } = await supabase.from("user_progress").update(update).eq("user_id", userId)
        if (error) throw error
      } catch (err) {
        console.warn("[useUserData] saveProgress enqueued offline:", err)
        await enqueueSyncItem({
          table: "user_progress",
          action: "update",
          payload: update,
          matchCriteria: { user_id: userId },
          userId,
          description: "Hunter Settings Update",
        })
      }
    },
    [reports, supabase, userId],
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

      // Optimistic update
      let nextReports: DailyReport[] = []
      const existingIndex = reports.findIndex(
        (r) => r.date.toDateString() === report.date.toDateString(),
      )
      if (existingIndex >= 0) {
        nextReports = [...reports]
        nextReports[existingIndex] = report
      } else {
        nextReports = [report, ...reports].slice(0, 30)
      }
      setReports(nextReports)
      saveLocalCache(progressRef.current, nextReports)

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "daily_reports",
          action: "upsert",
          payload: row,
          onConflict: "user_id,report_date",
          userId,
          description: `Daily Study Log (${row.report_date})`,
        })
        return
      }

      try {
        const { error } = await supabase
          .from("daily_reports")
          .upsert(row, { onConflict: "user_id,report_date" })

        if (error) throw error

        // Keep streaks table in sync with real study activity
        try {
          const todayStr = format(report.date, "yyyy-MM-dd")
          const { data: currentStreakRow } = await supabase
            .from("streaks")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle()

          if (currentStreakRow) {
            const allDates = new Set(
              [row.report_date, ...nextReports.map((r) => format(r.date, "yyyy-MM-dd"))]
            )
            let streakCount = 0
            let check = new Date(todayStr + "T00:00:00")
            while (allDates.has(format(check, "yyyy-MM-dd"))) {
              streakCount++
              check = new Date(check.getTime() - 86400000)
            }

            if (streakCount > (currentStreakRow.current_streak ?? 0)) {
              await supabase
                .from("streaks")
                .update({
                  current_streak: streakCount,
                  longest_streak: Math.max(currentStreakRow.longest_streak ?? 0, streakCount),
                  days_completed: Math.max(currentStreakRow.days_completed ?? 0, allDates.size),
                  last_quest_date: todayStr,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId)
            }
          }
        } catch {}
      } catch (err) {
        console.warn("[useUserData] saveReport failed, enqueued offline:", err)
        await enqueueSyncItem({
          table: "daily_reports",
          action: "upsert",
          payload: row,
          onConflict: "user_id,report_date",
          userId,
          description: `Daily Study Log (${row.report_date})`,
        })
      }
    },
    [reports, supabase, userId],
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

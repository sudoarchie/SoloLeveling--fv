"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { enqueueSyncItem } from "@/lib/offline-sync"

export interface Quest {
  id: string
  title: string
  description: string
  icon: string // Lucide icon name, resolved in the component
  target: number
  progress: number
  expReward: number
  completed: boolean
  completedAt?: string
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastQuestDate: string | null
  daysCompleted: number
  streakFreezes: number
}

export interface QuestReward {
  type: "common" | "rare" | "epic" | "legendary"
  message: string
  bonusExp: number
}

// Quest templates — issued fresh every morning
const QUEST_TEMPLATES: Omit<Quest, "progress" | "completed" | "completedAt">[] = [
  {
    id: "solve-mcqs",
    title: "Solve 20 practice questions",
    description: "Retrieval practice — testing yourself beats re-reading",
    icon: "PenLine",
    target: 20,
    expReward: 100,
  },
  {
    id: "revise-topic",
    title: "Revise 1 weak topic",
    description: "Tackle your hardest subject while it's fresh",
    icon: "BookOpen",
    target: 1,
    expReward: 80,
  },
  {
    id: "deep-work",
    title: "2× 25-min focused study",
    description: "Phone away, single task, full concentration",
    icon: "Target",
    target: 2,
    expReward: 120,
  },
  {
    id: "morning-start",
    title: "Start before 10 AM",
    description: "Early momentum protects evening rest",
    icon: "Sunrise",
    target: 1,
    expReward: 60,
  },
]

const CACHE_QUESTS_KEY = "gate_tracker_cached_quests"
const CACHE_STREAK_KEY = "gate_tracker_cached_streak"

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dayDiff(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00Z`).getTime()
  const b = new Date(`${dateB}T00:00:00Z`).getTime()
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24))
}

function rollReward(allCompleted: boolean): QuestReward | null {
  if (!allCompleted) return null
  const roll = Math.random()
  if (roll < 0.05) {
    return {
      type: "legendary",
      message: "Monarch’s Blessing: The dungeon bow before you.",
      bonusExp: 500,
    }
  }
  if (roll < 0.2) {
    return {
      type: "epic",
      message: "Shadow Extraction: A powerful routine rises.",
      bonusExp: 250,
    }
  }
  if (roll < 0.5) {
    return {
      type: "rare",
      message: "Hunter’s Instinct: Today you didn't hesitate.",
      bonusExp: 150,
    }
  }
  return {
    type: "common",
    message: "Gate Cleared: Consistency is your true weapon.",
    bonusExp: 75,
  }
}

export function useDailyQuests() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastQuestDate: null,
    daysCompleted: 0,
    streakFreezes: 0,
  })
  const [loading, setLoading] = useState(true)
  const [reward, setReward] = useState<QuestReward | null>(null)
  const [allDone, setAllDone] = useState(false)
  const initialized = useRef(false)

  // Initialize from cache immediately
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const cachedQ = localStorage.getItem(CACHE_QUESTS_KEY)
      if (cachedQ) {
        const parsed = JSON.parse(cachedQ)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuests(parsed)
          setAllDone(parsed.every((q: Quest) => q.completed))
        }
      }
      const cachedS = localStorage.getItem(CACHE_STREAK_KEY)
      if (cachedS) {
        setStreak(JSON.parse(cachedS))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedId = localStorage.getItem("gate_tracker_cached_user_id")
      if (cachedId) setUserId(cachedId)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id)
    }).catch(() => {})

    if (typeof navigator === "undefined" || navigator.onLine) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [supabase])

  const saveCache = (newQuests: Quest[], newStreak?: StreakData) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(CACHE_QUESTS_KEY, JSON.stringify(newQuests))
      if (newStreak) {
        localStorage.setItem(CACHE_STREAK_KEY, JSON.stringify(newStreak))
      }
    } catch {}
  }

  // Load or generate today's quests + streak
  const loadQuests = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const today = todayStr()

    try {
      // Fetch existing quest row for today
      const { data: existing, error } = await supabase
        .from("daily_quests")
        .select("*")
        .eq("user_id", userId)
        .eq("quest_date", today)
        .maybeSingle()

      if (existing) {
        const loadedQuests = existing.quests as Quest[]
        setQuests(loadedQuests)
        setAllDone(existing.all_completed)
        saveCache(loadedQuests)
      } else if (!error) {
        // The System issues fresh quests each day
        const fresh: Quest[] = QUEST_TEMPLATES.map((t) => ({
          ...t,
          progress: 0,
          completed: false,
        }))
        setQuests(fresh)
        setAllDone(false)
        saveCache(fresh)
        await supabase.from("daily_quests").insert({
          user_id: userId,
          quest_date: today,
          quests: fresh,
        })
      }

      // Fetch streak
      const { data: streakRow } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      if (streakRow) {
        const loadedStreak: StreakData = {
          currentStreak: streakRow.current_streak,
          longestStreak: streakRow.longest_streak,
          lastQuestDate: streakRow.last_quest_date,
          daysCompleted: streakRow.days_completed,
          streakFreezes: streakRow.streak_freezes,
        }
        setStreak(loadedStreak)
        saveCache(quests, loadedStreak)
      }
    } catch (err) {
      console.warn("[useDailyQuests] Network failed, running in offline mode:", err)
    } finally {
      setLoading(false)
    }
  }, [quests, supabase, userId])

  useEffect(() => {
    if (userId && !initialized.current) {
      initialized.current = true
      loadQuests()
    }
  }, [userId, loadQuests])

  // Streak logic with loss aversion
  const updateStreak = useCallback(
    async (bonusExp: number) => {
      if (!userId) return
      const today = todayStr()

      let current = { ...streak }
      try {
        const { data: row } = await supabase
          .from("streaks")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle()
        if (row) {
          current = {
            currentStreak: row.current_streak,
            longestStreak: row.longest_streak,
            lastQuestDate: row.last_quest_date,
            daysCompleted: row.days_completed,
            streakFreezes: row.streak_freezes,
          }
        }
      } catch {}

      let currentStreak = current.currentStreak
      const last = current.lastQuestDate

      if (last === today) {
        // Already counted today
      } else if (last && dayDiff(last, today) === 1) {
        currentStreak += 1
      } else if (last && dayDiff(last, today) > 1) {
        if (current.streakFreezes > 0) {
          currentStreak += 1
        } else {
          currentStreak = 1
        }
      } else {
        currentStreak = 1
      }

      const daysCompleted = current.daysCompleted + (last === today ? 0 : 1)
      const payload = {
        user_id: userId,
        current_streak: currentStreak,
        longest_streak: Math.max(current.longestStreak, currentStreak),
        last_quest_date: today,
        days_completed: daysCompleted,
        updated_at: new Date().toISOString(),
      }

      const nextStreakObj: StreakData = {
        currentStreak,
        longestStreak: Math.max(current.longestStreak, currentStreak),
        lastQuestDate: today,
        daysCompleted,
        streakFreezes: current.streakFreezes,
      }

      setStreak(nextStreakObj)
      saveCache(quests, nextStreakObj)

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "streaks",
          action: "upsert",
          payload,
          matchCriteria: { user_id: userId },
          userId,
          description: `Daily Streak (${currentStreak} days)`,
        })
        return
      }

      try {
        const { error } = await supabase.from("streaks").upsert(payload)
        if (error) throw error

        if (bonusExp > 0) {
          try {
            const { data: pRow } = await supabase
              .from("user_progress")
              .select("current_exp")
              .eq("user_id", userId)
              .maybeSingle()

            const nextExp = (pRow?.current_exp ?? 0) + bonusExp
            await supabase
              .from("user_progress")
              .update({ current_exp: nextExp, updated_at: new Date().toISOString() })
              .eq("user_id", userId)

            window.dispatchEvent(new CustomEvent("user-progress-changed"))
          } catch {}
        }
      } catch {
        await enqueueSyncItem({
          table: "streaks",
          action: "upsert",
          payload,
          matchCriteria: { user_id: userId },
          userId,
          description: `Daily Streak (${currentStreak} days)`,
        })
      }
    },
    [quests, streak, supabase, userId],
  )

  // Update quest progress; auto-complete at target
  const updateProgress = useCallback(
    async (questId: string, amount: number) => {
      if (!userId) return

      const next = quests.map((q) => {
        if (q.id !== questId) return q
        const progress = Math.min(q.target, Math.max(0, q.progress + amount))
        const completed = progress >= q.target
        return {
          ...q,
          progress,
          completed,
          completedAt: completed && !q.completed ? new Date().toISOString() : q.completedAt,
        }
      })

      setQuests(next)
      saveCache(next)

      const justCompleted = next.find((q) => q.id === questId)
      const wasCompleted = quests.find((q) => q.id === questId)?.completed
      const today = todayStr()

      if (justCompleted?.completed && !wasCompleted) {
        const isCurrentlyOnline = typeof navigator !== "undefined" && navigator.onLine

        if (!isCurrentlyOnline) {
          await enqueueSyncItem({
            table: "quest_log",
            action: "insert",
            payload: {
              user_id: userId,
              quest_id: questId,
              quest_title: justCompleted.title,
              exp_reward: justCompleted.expReward,
            },
            userId,
            description: `Completed Quest: ${justCompleted.title}`,
          })
        } else {
          try {
            await supabase.from("quest_log").insert({
              user_id: userId,
              quest_id: questId,
              quest_title: justCompleted.title,
              exp_reward: justCompleted.expReward,
            })

            if (justCompleted.expReward > 0) {
              const { data: pRow } = await supabase
                .from("user_progress")
                .select("current_exp")
                .eq("user_id", userId)
                .maybeSingle()

              const nextExp = (pRow?.current_exp ?? 0) + justCompleted.expReward
              await supabase
                .from("user_progress")
                .update({ current_exp: nextExp, updated_at: new Date().toISOString() })
                .eq("user_id", userId)

              window.dispatchEvent(new CustomEvent("user-progress-changed"))
            }
          } catch (err) {
            console.warn("[useDailyQuests] Enqueuing quest offline:", err)
            await enqueueSyncItem({
              table: "quest_log",
              action: "insert",
              payload: {
                user_id: userId,
                quest_id: questId,
                quest_title: justCompleted.title,
                exp_reward: justCompleted.expReward,
              },
              userId,
              description: `Completed Quest: ${justCompleted.title}`,
            })
          }
        }
      }

      const nowAllDone = next.every((q) => q.completed)
      const wasAllDone = quests.every((q) => q.completed)

      const dailyQuestsPayload = {
        user_id: userId,
        quest_date: today,
        quests: next,
        all_completed: nowAllDone,
        updated_at: new Date().toISOString(),
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "daily_quests",
          action: "upsert",
          payload: dailyQuestsPayload,
          onConflict: "user_id,quest_date",
          userId,
          description: `Quests Update (${nowAllDone ? "All Done" : "In Progress"})`,
        })
      } else {
        try {
          await supabase
            .from("daily_quests")
            .upsert(dailyQuestsPayload, { onConflict: "user_id,quest_date" })
        } catch {
          await enqueueSyncItem({
            table: "daily_quests",
            action: "upsert",
            payload: dailyQuestsPayload,
            onConflict: "user_id,quest_date",
            userId,
            description: `Quests Update (${nowAllDone ? "All Done" : "In Progress"})`,
          })
        }
      }

      // All quests complete → streak + variable reward
      if (nowAllDone && !wasAllDone) {
        const rewardRoll = rollReward(true)
        setReward(rewardRoll)
        setAllDone(true)
        await updateStreak(rewardRoll?.bonusExp ?? 0)
      }
    },
    [quests, supabase, updateStreak, userId],
  )

  // Dismiss reward popup
  const dismissReward = useCallback(() => setReward(null), [])

  return {
    quests,
    streak,
    loading,
    reward,
    allDone,
    updateProgress,
    dismissReward,
    templates: QUEST_TEMPLATES,
  }
}

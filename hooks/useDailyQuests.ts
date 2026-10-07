"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"

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
    description: "Your brain encodes memory best at its morning peak",
    icon: "Sunrise",
    target: 1,
    expReward: 50,
  },
]

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastQuestDate: null,
  daysCompleted: 0,
  streakFreezes: 0,
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

// Variable-ratio reward roll — unpredictable bonuses keep motivation high
function rollReward(allCompleted: boolean): QuestReward | null {
  if (!allCompleted) return null
  const roll = Math.random()
  if (roll < 0.02)
    return { type: "legendary", message: "JACKPOT: Streak Freeze earned!", bonusExp: 200 }
  if (roll < 0.10)
    return { type: "epic", message: "Big win: Bonus Study Pack unlocked", bonusExp: 100 }
  if (roll < 0.30)
    return { type: "rare", message: "Nice! +50 bonus EXP", bonusExp: 50 }
  return { type: "common", message: "Consistency bonus: +10 EXP", bonusExp: 10 }
}

export function useDailyQuests() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [streak, setStreak] = useState<StreakData>(EMPTY_STREAK)
  const [loading, setLoading] = useState(true)
  const [reward, setReward] = useState<QuestReward | null>(null)
  const [allDone, setAllDone] = useState(false)
  const initialized = useRef(false)

  // Load auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (!user) setLoading(false)
    })
  }, [supabase])

  // Load or generate today's quests + streak
  const loadQuests = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const today = todayStr()

    // Fetch existing quest row for today
    const { data: existing } = await supabase
      .from("daily_quests")
      .select("*")
      .eq("user_id", userId)
      .eq("quest_date", today)
      .maybeSingle()

    if (existing) {
      setQuests(existing.quests as Quest[])
      setAllDone(existing.all_completed)
    } else {
      // The System issues fresh quests each day
      const fresh: Quest[] = QUEST_TEMPLATES.map((t) => ({
        ...t,
        progress: 0,
        completed: false,
      }))
      setQuests(fresh)
      setAllDone(false)
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
      setStreak({
        currentStreak: streakRow.current_streak,
        longestStreak: streakRow.longest_streak,
        lastQuestDate: streakRow.last_quest_date,
        daysCompleted: streakRow.days_completed,
        streakFreezes: streakRow.streak_freezes,
      })
    }

    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (userId && !initialized.current) {
      initialized.current = true
      loadQuests()
    }
  }, [userId, loadQuests])

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

      const justCompleted = next.find((q) => q.id === questId)
      const wasCompleted = quests.find((q) => q.id === questId)?.completed
      if (justCompleted?.completed && !wasCompleted) {
        await supabase.from("quest_log").insert({
          user_id: userId,
          quest_id: questId,
          quest_title: justCompleted.title,
          exp_reward: justCompleted.expReward,
        })
      }

      const nowAllDone = next.every((q) => q.completed)
      const wasAllDone = quests.every((q) => q.completed)

      await supabase
        .from("daily_quests")
        .update({ quests: next, all_completed: nowAllDone, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("quest_date", todayStr())

      // All quests complete → streak + variable reward
      if (nowAllDone && !wasAllDone) {
        const rewardRoll = rollReward(true)
        setReward(rewardRoll)
        setAllDone(true)
        await updateStreak(rewardRoll?.bonusExp ?? 0)
      }
    },
    [quests, supabase, userId],
  )

  // Streak logic with loss aversion: break the chain, shadows die
  const updateStreak = useCallback(
    async (bonusExp: number) => {
      if (!userId) return
      const today = todayStr()

      const { data: row } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      const current = row ?? {
        current_streak: 0,
        longest_streak: 0,
        last_quest_date: null as string | null,
        days_completed: 0,
        streak_freezes: 0,
      }

      let currentStreak = current.current_streak
      const last = current.last_quest_date

      if (last === today) {
        // Already counted today
      } else if (last && dayDiff(last, today) === 1) {
        currentStreak += 1
      } else if (last && dayDiff(last, today) > 1) {
        // Streak broken — check for streak freeze
        if (current.streak_freezes > 0) {
          currentStreak += 1
          // consume a freeze implicitly
          await supabase
            .from("streaks")
            .update({ streak_freezes: current.streak_freezes - 1 })
            .eq("user_id", userId)
        } else {
          currentStreak = 1 // streak reset, start over
        }
      } else {
        currentStreak = 1
      }

      const daysCompleted = current.days_completed + (last === today ? 0 : 1)
      const payload = {
        user_id: userId,
        current_streak: currentStreak,
        longest_streak: Math.max(current.longest_streak, currentStreak),
        last_quest_date: today,
        days_completed: daysCompleted,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("streaks").upsert(payload)
      if (!error) {
        setStreak({
          currentStreak,
          longestStreak: Math.max(current.longest_streak, currentStreak),
          lastQuestDate: today,
          daysCompleted,
          streakFreezes: current.streak_freezes,
        })
      }
    },
    [supabase, userId],
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

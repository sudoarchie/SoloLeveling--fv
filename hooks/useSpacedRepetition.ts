"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { enqueueSyncItem } from "@/lib/offline-sync"

export type Difficulty = "easy" | "medium" | "hard"

export interface RevisionTopic {
  id: string
  name: string
  subject: string
  stage: number // 0: 1d, 1: 3d, 2: 7d, 3: 21d, 4: mastered
  reviewCount: number
  nextReviewDate: string // YYYY-MM-DD
  mastered: boolean
  difficulty: Difficulty
}

// Spaced repetition intervals in days (Leitner system variant)
export const REVIEW_INTERVALS = [1, 3, 7, 21] // stage 0→1→2→3; stage 4 is mastered
export const REVIEWS_TO_MASTER = REVIEW_INTERVALS.length

// EXP rewarded per successful review based on difficulty
const REVIEW_EXP: Record<Difficulty, number> = {
  easy: 25,
  medium: 50,
  hard: 80,
}

const CACHE_TOPICS_KEY = "gate_tracker_cached_revision_topics"

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr()).getTime()) / 86400000)
}

export function useSpacedRepetition() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [topics, setTopics] = useState<RevisionTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [masterCelebration, setMasterCelebration] = useState<string | null>(null)
  const initialized = useRef(false)

  // Initialize from cache immediately to prevent blank screen
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const cached = localStorage.getItem(CACHE_TOPICS_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) {
          setTopics(parsed)
        }
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

  const saveCache = (newTopics: RevisionTopic[]) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(CACHE_TOPICS_KEY, JSON.stringify(newTopics))
    } catch {}
  }

  const loadTopics = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("revision_topics")
        .select("*")
        .eq("user_id", userId)
        .order("next_review_date", { ascending: true })

      if (!error && data) {
        const loadedTopics: RevisionTopic[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          subject: row.subject,
          stage: row.stage,
          reviewCount: row.review_count,
          nextReviewDate: row.next_review_date,
          mastered: row.mastered,
          difficulty: (row.difficulty ?? "medium") as Difficulty,
        }))
        setTopics(loadedTopics)
        saveCache(loadedTopics)
      }
    } catch (err) {
      console.warn("[useSpacedRepetition] Network query failed, offline mode active:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    if (userId && !initialized.current) {
      initialized.current = true
      loadTopics()
    }
  }, [userId, loadTopics])

  const addTopic = useCallback(
    async (name: string, subject: string, difficulty: Difficulty = "medium") => {
      if (!userId || !name.trim()) return

      const newId = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const newTopic: RevisionTopic = {
        id: newId,
        name: name.trim(),
        subject: subject.trim() || "General",
        stage: 0,
        reviewCount: 0,
        nextReviewDate: todayStr(), // due immediately
        mastered: false,
        difficulty,
      }

      // Optimistic update
      const updatedTopics = [...topics, newTopic].sort((a, b) =>
        a.nextReviewDate.localeCompare(b.nextReviewDate)
      )
      setTopics(updatedTopics)
      saveCache(updatedTopics)

      const payload = {
        id: newId,
        user_id: userId,
        name: name.trim(),
        subject: subject.trim() || "General",
        stage: 0,
        review_count: 0,
        next_review_date: todayStr(),
        difficulty,
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "revision_topics",
          action: "insert",
          payload,
          userId,
          description: `Add Topic: ${name.trim()}`,
        })
        return
      }

      try {
        const { data, error } = await supabase
          .from("revision_topics")
          .insert(payload)
          .select()
          .single()

        if (!error && data) {
          // Replace generated ID with server ID if different
          setTopics((prev) =>
            prev.map((t) => (t.id === newId ? { ...t, id: data.id } : t))
          )
        }
      } catch (err) {
        console.warn("[useSpacedRepetition] addTopic failed, enqueued offline:", err)
        await enqueueSyncItem({
          table: "revision_topics",
          action: "insert",
          payload,
          userId,
          description: `Add Topic: ${name.trim()}`,
        })
      }
    },
    [supabase, topics, userId],
  )

  const removeTopic = useCallback(
    async (id: string) => {
      if (!userId) return
      const nextTopics = topics.filter((t) => t.id !== id)
      setTopics(nextTopics)
      saveCache(nextTopics)

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueSyncItem({
          table: "revision_topics",
          action: "delete",
          matchCriteria: { id, user_id: userId },
          userId,
          description: "Remove Topic",
        })
        return
      }

      try {
        await supabase.from("revision_topics").delete().eq("id", id).eq("user_id", userId)
      } catch {
        await enqueueSyncItem({
          table: "revision_topics",
          action: "delete",
          matchCriteria: { id, user_id: userId },
          userId,
          description: "Remove Topic",
        })
      }
    },
    [supabase, topics, userId],
  )

  // Complete a review: advance along the forgetting curve.
  const completeReview = useCallback(
    async (id: string, success: boolean, difficulty?: Difficulty): Promise<number> => {
      if (!userId) return 0

      const topic = topics.find((t) => t.id === id)
      if (!topic) return 0

      const newDifficulty = difficulty ?? topic.difficulty
      let nextStage: number
      let nextDate: string
      let mastered = false

      if (success) {
        nextStage = topic.stage + 1
        if (nextStage >= REVIEW_INTERVALS.length) {
          mastered = true
          nextDate = addDays(todayStr(), 365) // 1 year out
          setMasterCelebration(topic.name)
          setTimeout(() => setMasterCelebration(null), 4000)
        } else {
          nextDate = addDays(todayStr(), REVIEW_INTERVALS[nextStage])
        }
      } else {
        // Failed recall: reset to stage 0, due tomorrow
        nextStage = 0
        nextDate = addDays(todayStr(), 1)
      }

      const nextCount = topic.reviewCount + 1
      const expEarned = success ? REVIEW_EXP[newDifficulty] : 0

      const updatedTopics = topics
        .map((t) =>
          t.id === id
            ? {
                ...t,
                stage: nextStage,
                reviewCount: nextCount,
                nextReviewDate: nextDate,
                mastered,
                difficulty: newDifficulty,
              }
            : t,
        )
        .sort(
          (a, b) =>
            Number(a.mastered) - Number(b.mastered) ||
            a.nextReviewDate.localeCompare(b.nextReviewDate),
        )

      setTopics(updatedTopics)
      saveCache(updatedTopics)

      const updatePayload = {
        stage: nextStage,
        review_count: nextCount,
        next_review_date: nextDate,
        mastered,
        difficulty: newDifficulty,
        updated_at: new Date().toISOString(),
      }

      const today = todayStr()
      const isCurrentlyOnline = typeof navigator !== "undefined" && navigator.onLine

      if (!isCurrentlyOnline) {
        await enqueueSyncItem({
          table: "revision_topics",
          action: "update",
          payload: updatePayload,
          matchCriteria: { id, user_id: userId },
          userId,
          description: `Reviewed: ${topic.name}`,
        })
        return expEarned
      }

      try {
        await supabase
          .from("revision_topics")
          .update(updatePayload)
          .eq("id", id)
          .eq("user_id", userId)

        // Sync topic review to today's daily_reports
        const { data: todayReport } = await supabase
          .from("daily_reports")
          .select("id, topics_revised, exp_gained")
          .eq("user_id", userId)
          .eq("report_date", today)
          .maybeSingle()

        if (todayReport) {
          await supabase
            .from("daily_reports")
            .update({
              topics_revised: (todayReport.topics_revised || 0) + 1,
              exp_gained: (todayReport.exp_gained || 0) + expEarned,
              updated_at: new Date().toISOString(),
            })
            .eq("id", todayReport.id)
        } else {
          await supabase.from("daily_reports").insert({
            user_id: userId,
            report_date: today,
            practice_hours: 0,
            exp_gained: expEarned,
            lectures_completed: 0,
            topics_revised: 1,
            morning_session: false,
            exercise_done: false,
            distractions_level: "None",
          })
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("user-progress-changed"))
        }
      } catch (syncErr) {
        console.warn("[useSpacedRepetition] Review sync failed, queuing offline:", syncErr)
        await enqueueSyncItem({
          table: "revision_topics",
          action: "update",
          payload: updatePayload,
          matchCriteria: { id, user_id: userId },
          userId,
          description: `Reviewed: ${topic.name}`,
        })
      }

      return expEarned
    },
    [supabase, topics, userId],
  )

  const logStudiedTopics = useCallback(
    async (
      names: string[],
      difficulty: Difficulty = "medium",
    ): Promise<{ reviewed: number; added: number; exp: number }> => {
      if (!userId || names.length === 0) return { reviewed: 0, added: 0, exp: 0 }

      const normalized = Array.from(
        new Set(names.map((n) => n.trim()).filter(Boolean)),
      ).map((n) => n.toLowerCase())

      let reviewed = 0
      let added = 0
      let exp = 0

      // Advance existing topics
      const existing = topics.filter(
        (t) => !t.mastered && normalized.includes(t.name.toLowerCase()),
      )
      for (const topic of existing) {
        exp += await completeReview(topic.id, true, difficulty)
        reviewed++
      }

      // Create new topics
      const existingLower = new Set(topics.map((t) => t.name.toLowerCase()))
      const newNames = normalized.filter((n) => !existingLower.has(n))

      for (const name of newNames) {
        await addTopic(name, "General", difficulty)
        added++
      }

      return { reviewed, added, exp }
    },
    [addTopic, completeReview, topics, userId],
  )

  // Derived data
  const dueTopics = topics.filter((t) => !t.mastered && daysUntil(t.nextReviewDate) <= 0)
  const upcomingTopics = topics.filter((t) => !t.mastered && daysUntil(t.nextReviewDate) > 0)
  const masteredTopics = topics.filter((t) => t.mastered)

  return {
    topics,
    dueTopics,
    upcomingTopics,
    masteredTopics,
    loading,
    masterCelebration,
    addTopic,
    removeTopic,
    completeReview,
    logStudiedTopics,
  }
}

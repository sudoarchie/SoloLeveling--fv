"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"

export interface RevisionTopic {
  id: string
  name: string
  subject: string
  /** Index into REVIEW_INTERVALS: 0=1d, 1=3d, 2=7d, 3=21d */
  stage: number
  /** Successful review count (0-4). 4 = mastered */
  reviewCount: number
  nextReviewDate: string // ISO date
  mastered: boolean
  /** How hard the user finds this topic: easy | medium | hard */
  difficulty: Difficulty
}

export type Difficulty = "easy" | "medium" | "hard"

// Ebbinghaus forgetting curve schedule (days)
export const REVIEW_INTERVALS = [1, 3, 7, 21]
export const REVIEWS_TO_MASTER = 4

// Base EXP per review by stage (later reviews = stronger memory = more points)
const STAGE_EXP = [20, 40, 70, 120]
// Difficulty multipliers — harder topics earn more (desirable difficulty)
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
}

/** EXP awarded for a successful review of a topic at its current stage */
export function reviewExp(topic: Pick<RevisionTopic, "stage" | "difficulty">): number {
  const stage = Math.min(topic.stage, STAGE_EXP.length - 1)
  return Math.round(STAGE_EXP[stage] * DIFFICULTY_MULTIPLIER[topic.difficulty])
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (!user) setLoading(false)
    })
  }, [supabase])

  const loadTopics = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const { data, error } = await supabase
      .from("revision_topics")
      .select("*")
      .eq("user_id", userId)
      .order("next_review_date", { ascending: true })

    if (!error && data) {
      setTopics(
        data.map((row: any) => ({
          id: row.id,
          name: row.name,
          subject: row.subject,
          stage: row.stage,
          reviewCount: row.review_count,
          nextReviewDate: row.next_review_date,
          mastered: row.mastered,
          difficulty: (row.difficulty ?? "medium") as Difficulty,
        })),
      )
    }
    setLoading(false)
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

      const { data, error } = await supabase
        .from("revision_topics")
        .insert({
          user_id: userId,
          name: name.trim(),
          subject: subject.trim() || "General",
          stage: 0,
          review_count: 0,
          next_review_date: todayStr(), // due immediately
          difficulty,
        })
        .select()
        .single()

      if (!error && data) {
        setTopics((prev) =>
          [
            ...prev,
            {
              id: data.id,
              name: data.name,
              subject: data.subject,
              stage: data.stage,
              reviewCount: data.review_count,
              nextReviewDate: data.next_review_date,
              mastered: data.mastered,
              difficulty: (data.difficulty ?? "medium") as Difficulty,
            },
          ].sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate)),
        )
      }
    },
    [supabase, userId],
  )

  const removeTopic = useCallback(
    async (id: string) => {
      if (!userId) return
      setTopics((prev) => prev.filter((t) => t.id !== id))
      await supabase.from("revision_topics").delete().eq("id", id).eq("user_id", userId)
    },
    [supabase, userId],
  )

  // Complete a review: advance along the forgetting curve.
  // Returns the EXP earned (0 on failure).
  // Success → next interval (1d→3d→7d→21d→mastered)
  // Fail → reset to stage 0, due tomorrow (re-learn)
  const completeReview = useCallback(
    async (id: string, success: boolean, difficulty?: Difficulty): Promise<number> => {
      if (!userId) return 0

      const topic = topics.find((t) => t.id === id)
      if (!topic || topic.mastered) return 0

      const newDifficulty = difficulty ?? topic.difficulty
      const expEarned = success ? reviewExp({ stage: topic.stage, difficulty: newDifficulty }) : 0

      let nextStage: number
      let nextCount: number
      let mastered = false
      let nextDate: string

      if (success) {
        nextCount = topic.reviewCount + 1
        if (nextCount >= REVIEWS_TO_MASTER) {
          mastered = true
          nextStage = REVIEWS_TO_MASTER
          nextDate = topic.nextReviewDate // stays done
          setMasterCelebration(topic.name)
          setTimeout(() => setMasterCelebration(null), 5000)
        } else {
          nextStage = topic.stage + 1
          nextDate = addDays(todayStr(), REVIEW_INTERVALS[nextStage])
        }
      } else {
        // Forgot it — spacing resets (relearning is faster than initial learning)
        nextCount = Math.max(0, topic.reviewCount - 1)
        nextStage = 0
        nextDate = addDays(todayStr(), 1)
      }

      // Optimistic update
      setTopics((prev) =>
        prev
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
          .sort((a, b) => Number(a.mastered) - Number(b.mastered) || a.nextReviewDate.localeCompare(b.nextReviewDate)),
      )

      await supabase
        .from("revision_topics")
        .update({
          stage: nextStage,
          review_count: nextCount,
          next_review_date: nextDate,
          mastered,
          difficulty: newDifficulty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)

      return expEarned
    },
    [supabase, topics, userId],
  )

  /**
   * Called from the daily log: the user studied these topics today.
   * - Existing topic (not mastered) → counts as a successful review, schedule advances
   * - New topic → enters the system, first review due tomorrow (1d interval)
   * Returns { reviewed, added, exp } for UI feedback.
   */
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

      // Advance existing topics (studied today = successful recall)
      const existing = topics.filter(
        (t) => !t.mastered && normalized.includes(t.name.toLowerCase()),
      )
      for (const topic of existing) {
        exp += await completeReview(topic.id, true, difficulty)
        reviewed++
      }

      // Create new topics — first review due tomorrow
      const existingLower = new Set(topics.map((t) => t.name.toLowerCase()))
      const newNames = normalized.filter((n) => !existingLower.has(n))

      if (newNames.length > 0) {
        const rows = newNames.map((name) => ({
          user_id: userId,
          name,
          subject: "General",
          stage: 0,
          review_count: 0,
          next_review_date: addDays(todayStr(), REVIEW_INTERVALS[0]), // tomorrow
          difficulty,
        }))

        const { data, error } = await supabase
          .from("revision_topics")
          .insert(rows)
          .select()

        if (!error && data) {
          added = data.length
          setTopics((prev) =>
            [
              ...prev,
              ...data.map((row: any) => ({
                id: row.id,
                name: row.name,
                subject: row.subject,
                stage: row.stage,
                reviewCount: row.review_count,
                nextReviewDate: row.next_review_date,
                mastered: row.mastered,
                difficulty: (row.difficulty ?? "medium") as Difficulty,
              })),
            ].sort(
              (a, b) =>
                Number(a.mastered) - Number(b.mastered) ||
                a.nextReviewDate.localeCompare(b.nextReviewDate),
            ),
          )
        }
      }

      return { reviewed, added, exp }
    },
    [completeReview, supabase, topics, userId],
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

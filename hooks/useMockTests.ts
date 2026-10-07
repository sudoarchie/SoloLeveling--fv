"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"

export interface MockExam {
  id: string
  name: string
  totalMarks: number
}

export interface MockTestAttempt {
  id: string
  examId: string
  examName: string
  marksObtained: number
  totalMarks: number
  scorePct: number
  expGained: number
  attemptedAt: Date
}

/**
 * EXP formula for a mock test attempt:
 * - Base 200 EXP for taking the test
 * - Scaled by score percentage: 200 + (pct/100 * 300) → 200..500 EXP
 * - Personal best (highest score for that exam) gets a ×1.5 bonus
 *   → up to 750 EXP for a new record
 */
export const MOCK_BASE_EXP = 200
export const MOCK_MAX_BONUS_EXP = 300
export const MOCK_PB_MULTIPLIER = 1.5

export function mockTestExp(scorePct: number, isPersonalBest: boolean): number {
  const base = MOCK_BASE_EXP + Math.round((scorePct / 100) * MOCK_MAX_BONUS_EXP)
  return Math.round(base * (isPersonalBest ? MOCK_PB_MULTIPLIER : 1))
}

export function useMockTests() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [exams, setExams] = useState<MockExam[]>([])
  const [attempts, setAttempts] = useState<MockTestAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (!user) setLoading(false)
    })
  }, [supabase])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    const [{ data: examRows, error: examError }, { data: attemptRows, error: attemptError }] =
      await Promise.all([
        supabase
          .from("mock_exams")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("mock_test_attempts")
          .select("*, mock_exams(name)")
          .eq("user_id", userId)
          .order("attempted_at", { ascending: false })
          .limit(50),
      ])

    // Missing tables (schema not run) or other DB errors — surface them
    if (examError || attemptError) {
      const code = (examError as any)?.code ?? (attemptError as any)?.code
      if (code === "PGRST205" || code === "42P01") {
        setError(
          "Mock test tables are missing. Run supabase/schema.sql in the Supabase SQL Editor, then refresh.",
        )
      } else {
        setError(examError?.message ?? attemptError?.message ?? "Failed to load mock tests")
      }
      setLoading(false)
      return
    }

    if (examRows) {
      setExams(
        examRows.map((row: any) => ({
          id: row.id,
          name: row.name,
          totalMarks: row.total_marks,
        })),
      )
    }

    if (attemptRows) {
      setAttempts(
        attemptRows.map((row: any) => ({
          id: row.id,
          examId: row.exam_id,
          examName: row.mock_exams?.name ?? "Unknown exam",
          marksObtained: Number(row.marks_obtained),
          totalMarks: row.total_marks,
          scorePct: Number(row.score_pct),
          expGained: row.exp_gained,
          attemptedAt: new Date(row.attempted_at),
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

  // Create a new exam (the "+" option)
  const addExam = useCallback(
    async (name: string, totalMarks: number): Promise<MockExam | null> => {
      if (!userId || !name.trim()) return null

      const { data, error } = await supabase
        .from("mock_exams")
        .insert({
          user_id: userId,
          name: name.trim(),
          total_marks: totalMarks,
        })
        .select()
        .single()

      if (error || !data) return null

      const exam: MockExam = {
        id: data.id,
        name: data.name,
        totalMarks: data.total_marks,
      }
      setExams((prev) => [...prev, exam])
      return exam
    },
    [supabase, userId],
  )

  const removeExam = useCallback(
    async (id: string) => {
      if (!userId) return
      setExams((prev) => prev.filter((e) => e.id !== id))
      setAttempts((prev) => prev.filter((a) => a.examId !== id))
      await supabase.from("mock_exams").delete().eq("id", id).eq("user_id", userId)
    },
    [supabase, userId],
  )

  // Record an attempt. Awards EXP (personal-best bonus applies).
  // Returns the EXP earned (0 on failure).
  const recordAttempt = useCallback(
    async (examId: string, marksObtained: number): Promise<number> => {
      if (!userId) return 0

      const exam = exams.find((e) => e.id === examId)
      if (!exam || marksObtained < 0 || marksObtained > exam.totalMarks) return 0

      const scorePct = (marksObtained / exam.totalMarks) * 100

      // Personal best = highest score so far for this exam
      const prevBest = attempts
        .filter((a) => a.examId === examId)
        .reduce((max, a) => Math.max(max, a.scorePct), -1)
      const isPB = scorePct > prevBest

      const expGained = mockTestExp(scorePct, isPB)

      const { data, error } = await supabase
        .from("mock_test_attempts")
        .insert({
          user_id: userId,
          exam_id: examId,
          marks_obtained: marksObtained,
          total_marks: exam.totalMarks,
          score_pct: scorePct,
          exp_gained: expGained,
        })
        .select()
        .single()

      if (error || !data) return 0

      setAttempts((prev) =>
        [
          {
            id: data.id,
            examId: data.exam_id,
            examName: exam.name,
            marksObtained,
            totalMarks: exam.totalMarks,
            scorePct,
            expGained,
            attemptedAt: new Date(data.attempted_at),
          },
          ...prev,
        ].slice(0, 50),
      )

      return expGained
    },
    [attempts, exams, supabase, userId],
  )

  // Best score per exam (for display)
  const bestScores = useCallback(
    () =>
      exams.map((exam) => {
        const examAttempts = attempts.filter((a) => a.examId === exam.id)
        const best = examAttempts.reduce(
          (max, a) => (a.scorePct > max ? a.scorePct : max),
          -1,
        )
        const latest = examAttempts[0] ?? null
        return {
          exam,
          attemptCount: examAttempts.length,
          bestPct: best >= 0 ? best : null,
          latestPct: latest?.scorePct ?? null,
        }
      }),
    [attempts, exams],
  )

  return {
    exams,
    attempts,
    loading,
    error,
    addExam,
    removeExam,
    recordAttempt,
    bestScores,
    reload: load,
  }
}

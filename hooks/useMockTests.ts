"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"

export type ExamType = "full_paper" | "subject_wise" | "topic_test"

export interface MockExam {
  id: string
  name: string
  examType: ExamType
  subject?: string | null
  platform?: string | null
  totalMarks: number
}

export interface MockTestAttempt {
  id: string
  examId: string
  examName: string
  examType?: ExamType
  subject?: string | null
  platform?: string | null
  marksObtained: number
  totalMarks: number
  scorePct: number
  timeSpentMinutes?: number | null
  totalQuestions?: number | null
  questionsAttempted?: number | null
  questionsCorrect?: number | null
  questionsIncorrect?: number | null
  accuracyPct?: number | null
  expGained: number
  notes?: string | null
  attemptedAt: Date
}

export interface CreateExamOptions {
  examType?: ExamType
  subject?: string
  platform?: string
}

export interface RecordAttemptDetails {
  timeSpentMinutes?: number | null
  totalQuestions?: number | null
  questionsAttempted?: number | null
  questionsCorrect?: number | null
  questionsIncorrect?: number | null
  notes?: string | null
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

export const SETUP_SQL = `-- Run in Supabase SQL Editor:
create table if not exists public.user_mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_type text not null default 'full_paper' check (exam_type in ('full_paper', 'subject_wise', 'topic_test')),
  subject text default null,
  platform text default null,
  total_marks numeric(6,2) not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.user_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.user_mock_exams(id) on delete cascade,
  marks_obtained numeric(6,2) not null,
  total_marks numeric(6,2) not null,
  score_pct numeric(5,2) not null,
  time_spent_minutes integer default null,
  total_questions integer default null,
  questions_attempted integer default null,
  questions_correct integer default null,
  questions_incorrect integer default null,
  accuracy_pct numeric(5,2) default null,
  exp_gained integer not null default 0,
  notes text default null,
  attempted_at timestamptz not null default now()
);

alter table public.user_mock_exams enable row level security;
alter table public.user_mock_attempts enable row level security;

drop policy if exists "Users can CRUD own user_mock_exams" on public.user_mock_exams;
create policy "Users can CRUD own user_mock_exams"
  on public.user_mock_exams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own user_mock_attempts" on public.user_mock_attempts;
create policy "Users can CRUD own user_mock_attempts"
  on public.user_mock_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_user_mock_exams_user on public.user_mock_exams (user_id, created_at);
create index if not exists idx_user_mock_attempts_user on public.user_mock_attempts (user_id, attempted_at desc);
create index if not exists idx_user_mock_attempts_exam on public.user_mock_attempts (exam_id, attempted_at desc);`

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
          .from("user_mock_exams")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_mock_attempts")
          .select("*, user_mock_exams(name, exam_type, subject, platform)")
          .eq("user_id", userId)
          .order("attempted_at", { ascending: false })
          .limit(50),
      ])

    // Missing tables (schema not run) or other DB errors — surface them cleanly
    if (examError || attemptError) {
      const err = examError ?? attemptError
      const code = (err as any)?.code
      if (
        code === "PGRST205" ||
        code === "42P01" ||
        err?.message?.includes("does not exist") ||
        err?.message?.includes("mock_exams")
      ) {
        setError(
          "Mock test tables are not set up in Supabase yet. Run the SQL setup script in Supabase SQL Editor.",
        )
      } else {
        setError(err?.message ?? "Failed to load mock tests")
      }
      setLoading(false)
      return
    }

    if (examRows) {
      setExams(
        examRows.map((row: any) => ({
          id: row.id,
          name: row.name,
          examType: row.exam_type ?? "full_paper",
          subject: row.subject ?? null,
          platform: row.platform ?? null,
          totalMarks: Number(row.total_marks),
        })),
      )
    }

    if (attemptRows) {
      setAttempts(
        attemptRows.map((row: any) => ({
          id: row.id,
          examId: row.exam_id,
          examName: row.user_mock_exams?.name ?? "Unknown exam",
          examType: row.user_mock_exams?.exam_type ?? "full_paper",
          subject: row.user_mock_exams?.subject ?? null,
          platform: row.user_mock_exams?.platform ?? null,
          marksObtained: Number(row.marks_obtained),
          totalMarks: Number(row.total_marks),
          scorePct: Number(row.score_pct),
          timeSpentMinutes: row.time_spent_minutes ?? null,
          totalQuestions: row.total_questions ?? null,
          questionsAttempted: row.questions_attempted ?? null,
          questionsCorrect: row.questions_correct ?? null,
          questionsIncorrect: row.questions_incorrect ?? null,
          accuracyPct: row.accuracy_pct !== null ? Number(row.accuracy_pct) : null,
          expGained: Number(row.exp_gained ?? 0),
          notes: row.notes ?? null,
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

  // Create a new exam
  const addExam = useCallback(
    async (
      name: string,
      totalMarks: number,
      options?: CreateExamOptions,
    ): Promise<MockExam | null> => {
      if (!userId || !name.trim()) return null

      const { data, error } = await supabase
        .from("user_mock_exams")
        .insert({
          user_id: userId,
          name: name.trim(),
          exam_type: options?.examType ?? "full_paper",
          subject: options?.subject?.trim() || null,
          platform: options?.platform?.trim() || null,
          total_marks: totalMarks,
        })
        .select()
        .single()

      if (error || !data) return null

      const exam: MockExam = {
        id: data.id,
        name: data.name,
        examType: data.exam_type ?? "full_paper",
        subject: data.subject,
        platform: data.platform,
        totalMarks: Number(data.total_marks),
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
      await supabase.from("user_mock_exams").delete().eq("id", id).eq("user_id", userId)
    },
    [supabase, userId],
  )

  // Record an attempt. Awards EXP (personal-best bonus applies).
  // Returns the EXP earned (0 on failure).
  const recordAttempt = useCallback(
    async (
      examId: string,
      marksObtained: number,
      details?: RecordAttemptDetails,
    ): Promise<number> => {
      if (!userId) return 0

      const exam = exams.find((e) => e.id === examId)
      if (!exam || marksObtained < 0 || marksObtained > exam.totalMarks) return 0

      const scorePct = (marksObtained / exam.totalMarks) * 100

      // Calculate accuracy percentage if attempted questions provided
      let accuracyPct: number | null = null
      if (details?.questionsAttempted && details.questionsAttempted > 0) {
        const correct = details.questionsCorrect ?? 0
        accuracyPct = Number(((correct / details.questionsAttempted) * 100).toFixed(1))
      }

      // Personal best = highest score so far for this exam
      const prevBest = attempts
        .filter((a) => a.examId === examId)
        .reduce((max, a) => Math.max(max, a.scorePct), -1)
      const isPB = scorePct > prevBest

      const expGained = mockTestExp(scorePct, isPB)

      const payload: any = {
        user_id: userId,
        exam_id: examId,
        marks_obtained: marksObtained,
        total_marks: exam.totalMarks,
        score_pct: scorePct,
        exp_gained: expGained,
      }

      if (details?.timeSpentMinutes !== undefined && details.timeSpentMinutes !== null) {
        payload.time_spent_minutes = details.timeSpentMinutes
      }
      if (details?.totalQuestions !== undefined && details.totalQuestions !== null) {
        payload.total_questions = details.totalQuestions
      }
      if (details?.questionsAttempted !== undefined && details.questionsAttempted !== null) {
        payload.questions_attempted = details.questionsAttempted
      }
      if (details?.questionsCorrect !== undefined && details.questionsCorrect !== null) {
        payload.questions_correct = details.questionsCorrect
      }
      if (details?.questionsIncorrect !== undefined && details.questionsIncorrect !== null) {
        payload.questions_incorrect = details.questionsIncorrect
      }
      if (accuracyPct !== null) {
        payload.accuracy_pct = accuracyPct
      }
      if (details?.notes) {
        payload.notes = details.notes.trim()
      }

      const { data, error } = await supabase
        .from("user_mock_attempts")
        .insert(payload)
        .select()
        .single()

      if (error || !data) return 0

      setAttempts((prev) =>
        [
          {
            id: data.id,
            examId: data.exam_id,
            examName: exam.name,
            examType: exam.examType,
            subject: exam.subject,
            platform: exam.platform,
            marksObtained,
            totalMarks: exam.totalMarks,
            scorePct,
            timeSpentMinutes: data.time_spent_minutes,
            totalQuestions: data.total_questions,
            questionsAttempted: data.questions_attempted,
            questionsCorrect: data.questions_correct,
            questionsIncorrect: data.questions_incorrect,
            accuracyPct: data.accuracy_pct !== null ? Number(data.accuracy_pct) : null,
            expGained,
            notes: data.notes,
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

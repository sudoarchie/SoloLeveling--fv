"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowLeft, BarChart3, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Download, Eye, FileJson, Flag, History, Loader2, Play, RefreshCw, RotateCcw, Save, Send, Target, Trophy, XCircle, Zap } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { MOCK_IMAGE_BUCKET, emptyMockAnswer, formatExamTime, hasMockAnswer, mockError, type MockAnswer, type MockAttempt, type MockAttemptSummary, type MockPaper, type MockQuestion, type QuestionImage } from "@/lib/mock-tests"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZE = 12

function QuestionImages({ images = [], urls }: { images?: QuestionImage[]; urls: Record<string, string> }) {
  return images.length > 0 ? (
    <div className="mt-4 flex flex-wrap gap-3">
      {images.map((image, index) => urls[image.path] ? (
        <a key={`${image.path}-${index}`} href={urls[image.path]} target="_blank" rel="noreferrer" className="max-w-full rounded-lg border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[image.path]} alt={image.alt || "Question diagram"} className="max-h-96 max-w-full object-contain" />
        </a>
      ) : <div key={`${image.path}-${index}`} className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Image unavailable</div>)}
    </div>
  ) : null
}

function answerOrEmpty(answers: Record<string, MockAnswer>, questionId: string) {
  return answers[questionId] ?? emptyMockAnswer()
}

function allImagePaths(questions: MockQuestion[]) {
  return Array.from(new Set(questions.flatMap(question => [
    ...(question.images ?? []),
    ...(question.options ?? []).flatMap(option => option.images ?? []),
  ]).map(image => image.path)))
}

function attemptPercentage(attempt: MockAttemptSummary) {
  if (attempt.score === null || attempt.total_marks === null || attempt.total_marks <= 0) return null
  return (Number(attempt.score) / Number(attempt.total_marks)) * 100
}

function ResultView({ attempt, urls, onBack, onRetake, retaking }: { attempt: MockAttempt; urls: Record<string, string>; onBack: () => void; onRetake: () => void; retaking: boolean }) {
  const result = attempt.result
  if (!result) return null
  const percentage = Number(result.percentage)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-3" onClick={onBack}><ArrowLeft />All mock tests</Button>
        {attempt.paper_id && <Button variant="outline" onClick={onRetake} disabled={retaking}>{retaking ? <Loader2 className="animate-spin" /> : <RotateCcw />}Retake test</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Trophy className="h-6 w-6 text-primary" /></div>
          <CardTitle className="text-2xl">Test completed</CardTitle>
          <CardDescription>{attempt.title} · {attempt.exam} {attempt.year}</CardDescription>
          {attempt.completion_reason === "timeout" && <Badge variant="secondary" className="mx-auto mt-2">Time expired</Badge>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-4xl font-semibold tabular-nums">{Number(result.score).toFixed(2)} <span className="text-lg font-normal text-muted-foreground">/ {Number(result.total_marks).toFixed(2)}</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{percentage.toFixed(1)}%</p>
            <Progress value={Math.max(0, Math.min(100, percentage))} className="mt-4 h-2" />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-semibold text-amber-700 dark:text-amber-300">
              <Zap className="h-4 w-4 fill-current" />+{Number(result.exp_gained ?? 0).toLocaleString()} EXP
              {result.is_personal_best && <Badge variant="outline" className="border-amber-500/40">Personal best</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-4 text-center"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-500" /><p className="text-2xl font-semibold tabular-nums">{result.correct}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div className="rounded-xl border p-4 text-center"><XCircle className="mx-auto mb-2 h-5 w-5 text-destructive" /><p className="text-2xl font-semibold tabular-nums">{result.incorrect}</p><p className="text-xs text-muted-foreground">Incorrect</p></div>
            <div className="rounded-xl border p-4 text-center"><Circle className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><p className="text-2xl font-semibold tabular-nums">{result.unanswered}</p><p className="text-xs text-muted-foreground">Unanswered</p></div>
          </div>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Save className="h-4 w-4" />Result and responses saved for performance analysis</p>
        </CardContent>
      </Card>

      <div><h3 className="text-lg font-semibold">Answer review</h3><p className="mt-1 text-sm text-muted-foreground">Review every response, the answer key, and available explanations.</p></div>
      <div className="space-y-4">
        {attempt.questions.map(question => {
          const answer = answerOrEmpty(attempt.answers, question.id)
          const grade = result.question_results[question.id]
          const correctIds = question.correct_option_ids ?? []
          return (
            <Card key={question.id} className={cn("border-l-4", grade?.status === "correct" && "border-l-emerald-500", grade?.status === "incorrect" && "border-l-destructive", grade?.status === "unanswered" && "border-l-muted-foreground/40")}>
              <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Question {question.question_number}</CardTitle><div className="flex items-center gap-2"><Badge variant={grade?.status === "correct" ? "default" : grade?.status === "incorrect" ? "destructive" : "secondary"}>{grade?.status ?? "unanswered"}</Badge><span className="text-sm tabular-nums text-muted-foreground">{Number(grade?.awarded_marks ?? 0).toFixed(2)} marks</span></div></div></CardHeader>
              <CardContent className="space-y-4">
                <div><p className="whitespace-pre-wrap text-sm leading-6">{question.question_text}</p><QuestionImages images={question.images} urls={urls} /></div>
                {question.question_type === "nat" ? (
                  <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">Your answer</p><p className="font-medium">{answer.numeric_answer || "Not answered"}</p></div><div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">Accepted answer</p><p className="font-medium">{question.answer_min === question.answer_max ? question.answer_min : `${question.answer_min} to ${question.answer_max}`}</p></div></div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">{question.options.map(option => {
                    const selected = answer.option_ids.includes(option.id)
                    const correct = correctIds.includes(option.id)
                    return <div key={option.id} className={cn("rounded-lg border p-3 text-sm", correct && "border-emerald-500/50 bg-emerald-500/5", selected && !correct && "border-destructive/50 bg-destructive/5")}><div className="flex items-start gap-2"><span className="font-semibold">{option.id}.</span><span className="min-w-0 whitespace-pre-wrap">{option.text}</span></div><QuestionImages images={option.images} urls={urls} /><div className="mt-2 flex gap-2 text-xs">{correct && <span className="text-emerald-600 dark:text-emerald-400">Correct answer</span>}{selected && <span className="text-muted-foreground">Your choice</span>}</div></div>
                  })}</div>
                )}
                {question.explanation && <div className="rounded-lg bg-muted/60 p-4 text-sm"><p className="mb-1 font-medium">Explanation</p><p className="whitespace-pre-wrap leading-6 text-muted-foreground">{question.explanation}</p></div>}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function ExamRunner({ initialAttempt, onAttemptChange, onExit, onRetake, retaking }: { initialAttempt: MockAttempt; onAttemptChange: (attempt: MockAttempt) => void; onExit: () => void; onRetake: () => void; retaking: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [attempt, setAttempt] = useState(initialAttempt)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, (new Date(initialAttempt.deadline_at).getTime() - new Date(initialAttempt.server_now).getTime()) / 1000))
  const [serverOffset, setServerOffset] = useState(() => new Date(initialAttempt.server_now).getTime() - Date.now())
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [imageWarning, setImageWarning] = useState(false)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const answersRef = useRef(attempt.answers)
  const dirtyRef = useRef(new Set<string>())
  const saveTimersRef = useRef(new Map<string, number>())
  const persistAnswerRef = useRef<(questionId: string) => Promise<boolean>>(async () => true)
  const completionPending = useRef(false)

  const replaceAttempt = useCallback((next: MockAttempt) => {
    answersRef.current = next.answers
    setAttempt(next)
    onAttemptChange(next)
    if (next.server_now) setServerOffset(new Date(next.server_now).getTime() - Date.now())
    if (next.status === "completed") window.dispatchEvent(new Event("user-progress-changed"))
  }, [onAttemptChange])

  useEffect(() => { answersRef.current = attempt.answers }, [attempt.answers])

  useEffect(() => {
    let cancelled = false
    const loadImages = async () => {
      const paths = allImagePaths(attempt.questions)
      const nextUrls: Record<string, string> = {}
      let missing = false
      for (let index = 0; index < paths.length; index += 100) {
        const result = await supabase.storage.from(MOCK_IMAGE_BUCKET).createSignedUrls(paths.slice(index, index + 100), 86400)
        if (result.error) missing = true
        for (const image of result.data ?? []) {
          if (image.path && image.signedUrl && !image.error) nextUrls[image.path] = image.signedUrl
          else missing = true
        }
      }
      if (!cancelled) { setUrls(nextUrls); setImageWarning(missing) }
    }
    void loadImages()
    return () => { cancelled = true }
  }, [attempt.id, attempt.questions, supabase])

  const persistAnswer = useCallback(async (questionId: string) => {
    const timer = saveTimersRef.current.get(questionId)
    if (timer) window.clearTimeout(timer)
    saveTimersRef.current.delete(questionId)
    if (!dirtyRef.current.has(questionId) || attempt.status !== "in_progress") return true
    const answer = answersRef.current[questionId] ?? emptyMockAnswer()
    const snapshot = JSON.stringify(answer)
    setSaving(current => new Set(current).add(questionId))
    const { data, error } = await supabase.rpc("save_mock_exam_answer", { p_attempt_id: attempt.id, p_question_id: questionId, p_option_ids: answer.option_ids, p_numeric_answer: answer.numeric_answer, p_marked_for_review: answer.marked_for_review })
    setSaving(current => { const next = new Set(current); next.delete(questionId); return next })
    if (error) { toast.error("Couldn’t save this response", { description: mockError(error) }); return false }
    if (data?.status === "completed") { dirtyRef.current.clear(); replaceAttempt(data as MockAttempt); return true }
    if (JSON.stringify(answersRef.current[questionId] ?? emptyMockAnswer()) === snapshot) dirtyRef.current.delete(questionId)
    return true
  }, [attempt.id, attempt.status, replaceAttempt, supabase])
  persistAnswerRef.current = persistAnswer

  const changeAnswer = useCallback((questionId: string, next: MockAnswer, delay = 300) => {
    answersRef.current = { ...answersRef.current, [questionId]: next }
    setAttempt(current => ({ ...current, answers: answersRef.current }))
    dirtyRef.current.add(questionId)
    const previousTimer = saveTimersRef.current.get(questionId)
    if (previousTimer) window.clearTimeout(previousTimer)
    const timer = window.setTimeout(() => { void persistAnswer(questionId) }, delay)
    saveTimersRef.current.set(questionId, timer)
  }, [persistAnswer])

  const finishAttempt = useCallback(async (timedOut = false) => {
    if (completionPending.current || attempt.status !== "in_progress") return
    completionPending.current = true
    setSubmitting(true)
    try {
      if (!timedOut) {
        for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer)
        saveTimersRef.current.clear()
        const saves = await Promise.all(Array.from(dirtyRef.current).map(persistAnswer))
        if (saves.some(saved => !saved)) { toast.error("Some responses are not saved yet. Try submitting again."); return }
      }
      const { data, error } = await supabase.rpc("submit_mock_exam", { p_attempt_id: attempt.id })
      if (error) throw error
      replaceAttempt(data as MockAttempt)
      setSubmitOpen(false)
      toast.success(timedOut ? "Time is up. Your test was submitted." : "Test submitted successfully")
    } catch (error) {
      toast.error("Couldn’t submit the test", { description: mockError(error) })
    } finally {
      completionPending.current = false
      setSubmitting(false)
    }
  }, [attempt.id, attempt.status, persistAnswer, replaceAttempt, supabase])

  const saveAndExit = async () => {
    setExiting(true)
    for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer)
    saveTimersRef.current.clear()
    const saves = await Promise.all(Array.from(dirtyRef.current).map(persistAnswer))
    setExiting(false)
    if (saves.some(saved => !saved)) {
      toast.error("Couldn’t save every response. Try exiting again.")
      return
    }
    onExit()
  }

  useEffect(() => {
    if (attempt.status !== "in_progress") return
    const update = () => {
      const seconds = Math.max(0, (new Date(attempt.deadline_at).getTime() - (Date.now() + serverOffset)) / 1000)
      setRemainingSeconds(seconds)
      if (seconds <= 0) void finishAttempt(true)
    }
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [attempt.deadline_at, attempt.status, finishAttempt, serverOffset])

  useEffect(() => {
    if (attempt.status !== "in_progress") return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [attempt.status])

  useEffect(() => () => {
    for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer)
    for (const questionId of dirtyRef.current) void persistAnswerRef.current(questionId)
  }, [])

  if (attempt.status === "completed") return <ResultView attempt={attempt} urls={urls} onBack={onExit} onRetake={onRetake} retaking={retaking} />

  const question = attempt.questions[currentIndex]
  const answer = answerOrEmpty(attempt.answers, question.id)
  const answered = attempt.questions.filter(item => hasMockAnswer(item, attempt.answers[item.id])).length
  const reviewed = attempt.questions.filter(item => attempt.answers[item.id]?.marked_for_review).length
  const unanswered = attempt.questions.length - answered
  const timeCritical = remainingSeconds <= 300

  const goTo = (index: number) => {
    void persistAnswer(question.id)
    setCurrentIndex(Math.max(0, Math.min(attempt.questions.length - 1, index)))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const toggleOption = (optionId: string) => {
    const optionIds = question.question_type === "mcq" ? [optionId] : answer.option_ids.includes(optionId) ? answer.option_ids.filter(id => id !== optionId) : [...answer.option_ids, optionId]
    changeAnswer(question.id, { ...answer, option_ids: optionIds })
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{attempt.title}</p><p className="text-xs text-muted-foreground">{attempt.exam} {attempt.year} · Question {currentIndex + 1} of {attempt.questions.length}</p></div><div className="flex items-center gap-2"><div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-semibold tabular-nums", timeCritical && "border-destructive/50 bg-destructive/5 text-destructive")}><Clock3 className="h-4 w-4" />{formatExamTime(remainingSeconds)}</div><Button variant="outline" size="sm" onClick={() => setExitOpen(true)}>Exit</Button><Button size="sm" onClick={() => setSubmitOpen(true)}><Send />Submit</Button></div></div>
        <Progress value={(answered / attempt.questions.length) * 100} className="mt-3 h-1" />
      </div>

      {imageWarning && <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><AlertCircle className="h-4 w-4 text-amber-500" />Some question images could not be loaded.</div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0">
          <CardHeader className="border-b pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><CardTitle>Question {question.question_number}</CardTitle><Badge variant="secondary">{question.question_type.toUpperCase()}</Badge></div><div className="text-right text-xs text-muted-foreground"><p>{question.marks} {Number(question.marks) === 1 ? "mark" : "marks"}</p>{Number(question.negative_marks) > 0 && <p>−{question.negative_marks} for an incorrect answer</p>}</div></div></CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div><p className="whitespace-pre-wrap break-words leading-7">{question.question_text}</p><QuestionImages images={question.images} urls={urls} /></div>
            {question.question_type === "nat" ? (
              <div className="max-w-sm space-y-2"><Label htmlFor={`numeric-${question.id}`}>Numerical answer</Label><Input id={`numeric-${question.id}`} inputMode="decimal" autoComplete="off" placeholder="Enter a number" value={answer.numeric_answer ?? ""} onChange={event => changeAnswer(question.id, { ...answer, numeric_answer: event.target.value || null }, 650)} onBlur={() => void persistAnswer(question.id)} /></div>
            ) : question.question_type === "mcq" ? (
              <RadioGroup value={answer.option_ids[0] ?? ""} onValueChange={toggleOption} className="gap-3">{question.options.map(option => <label key={option.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50", answer.option_ids.includes(option.id) && "border-primary bg-primary/5")}><RadioGroupItem value={option.id} className="mt-0.5" /><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><span className="font-semibold">{option.id}.</span><span className="whitespace-pre-wrap text-sm leading-6">{option.text}</span></div><QuestionImages images={option.images} urls={urls} /></div></label>)}</RadioGroup>
            ) : (
              <div className="space-y-3"><p className="text-xs text-muted-foreground">Select all options that apply.</p>{question.options.map(option => <label key={option.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50", answer.option_ids.includes(option.id) && "border-primary bg-primary/5")}><Checkbox checked={answer.option_ids.includes(option.id)} onCheckedChange={() => toggleOption(option.id)} className="mt-0.5" /><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><span className="font-semibold">{option.id}.</span><span className="whitespace-pre-wrap text-sm leading-6">{option.text}</span></div><QuestionImages images={option.images} urls={urls} /></div></label>)}</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <div className="flex flex-wrap items-center gap-2"><Button variant={answer.marked_for_review ? "secondary" : "outline"} size="sm" onClick={() => changeAnswer(question.id, { ...answer, marked_for_review: !answer.marked_for_review }, 0)}><Flag className={answer.marked_for_review ? "fill-current" : ""} />{answer.marked_for_review ? "Marked for review" : "Mark for review"}</Button>{hasMockAnswer(question, answer) && <Button variant="ghost" size="sm" onClick={() => changeAnswer(question.id, { ...answer, option_ids: [], numeric_answer: null })}>Clear response</Button>}<span className="text-xs text-muted-foreground">{saving.has(question.id) ? "Saving…" : dirtyRef.current.has(question.id) ? "Save pending" : "Saved"}</span></div>
              <div className="flex gap-2"><Button variant="outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}><ChevronLeft />Previous</Button>{currentIndex < attempt.questions.length - 1 ? <Button onClick={() => goTo(currentIndex + 1)}>Save & next<ChevronRight /></Button> : <Button onClick={() => setSubmitOpen(true)}>Review & submit<Send /></Button>}</div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Question navigator</CardTitle><CardDescription>Jump to any question.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-5 gap-2">{attempt.questions.map((item, index) => {
            const itemAnswer = attempt.answers[item.id]
            const isAnswered = hasMockAnswer(item, itemAnswer)
            const marked = itemAnswer?.marked_for_review
            return <button key={item.id} type="button" aria-label={`Question ${item.question_number}${isAnswered ? ", answered" : ""}${marked ? ", marked for review" : ""}`} onClick={() => goTo(index)} className={cn("relative flex aspect-square items-center justify-center rounded-md border text-xs font-medium transition-colors hover:bg-muted", isAnswered && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", index === currentIndex && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>{item.question_number}{marked && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />}</button>
          })}</div><div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-xs"><div><p className="font-semibold text-emerald-600 dark:text-emerald-400">{answered}</p><p className="text-muted-foreground">Answered</p></div><div><p className="font-semibold">{unanswered}</p><p className="text-muted-foreground">Unanswered</p></div><div><p className="font-semibold text-amber-600 dark:text-amber-400">{reviewed}</p><p className="text-muted-foreground">Review</p></div></div></CardContent></Card>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground"><p><span className="font-medium text-foreground">MCQ:</span> choose one option.</p><p><span className="font-medium text-foreground">MSQ:</span> choose one or more options.</p><p><span className="font-medium text-foreground">NAT:</span> enter a numerical answer.</p></div>
        </aside>
      </div>

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Submit this mock test?</AlertDialogTitle><AlertDialogDescription>Your test will be graded immediately. You answered {answered} of {attempt.questions.length} questions and marked {reviewed} for review. You cannot change responses after submission.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={submitting}>Continue test</AlertDialogCancel><AlertDialogAction disabled={submitting} onClick={event => { event.preventDefault(); void finishAttempt(false) }}>{submitting ? <Loader2 className="animate-spin" /> : <Send />}Submit test</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Exit the test?</AlertDialogTitle><AlertDialogDescription>Your saved responses will remain available, but the exam timer will continue running. You can resume from the mock test page before time expires.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={exiting}>Stay in test</AlertDialogCancel><AlertDialogAction disabled={exiting} onClick={event => { event.preventDefault(); void saveAndExit() }}>{exiting ? <Loader2 className="animate-spin" /> : <Save />}Save and exit</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

export function MockQuestionBank() {
  const supabase = useMemo(() => createClient(), [])
  const [exam, setExam] = useState("GATE")
  const [exams, setExams] = useState<string[]>(["GATE"])
  const [papers, setPapers] = useState<MockPaper[]>([])
  const [attempts, setAttempts] = useState<MockAttemptSummary[]>([])
  const [activeAttempt, setActiveAttempt] = useState<MockAttempt | null>(null)
  const [paperToStart, setPaperToStart] = useState<MockPaper | null>(null)
  const [startingPaperId, setStartingPaperId] = useState<string | null>(null)
  const [openingAttemptId, setOpeningAttemptId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => { const timer = window.setTimeout(() => { setFilter(search); setPage(0) }, 250); return () => window.clearTimeout(timer) }, [search])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data, error } = await supabase.rpc("list_mock_exam_attempts")
    if (error) setError(mockError(error))
    else setAttempts(((data ?? []) as MockAttemptSummary[]).map(row => ({ ...row, score: row.score === null ? null : Number(row.score), total_marks: row.total_marks === null ? null : Number(row.total_marks), exp_gained: Number(row.exp_gained ?? 0), is_personal_best: Boolean(row.is_personal_best) })))
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError(null)
      let query = supabase.from("mock_paper_catalog").select("id, title, exam, year, subject, duration_minutes, question_count", { count: "exact" }).eq("exam", exam).order("year", { ascending: false }).order("id")
      if (filter.trim()) query = query.ilike("title", `%${filter.trim().replace(/[%_\\]/g, "\\$&")}%`)
      const [paperResult, examResult] = await Promise.all([query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1), supabase.rpc("list_mock_exams")])
      if (cancelled) return
      if (paperResult.error || examResult.error) setError(mockError(paperResult.error ?? examResult.error))
      else {
        setPapers((paperResult.data ?? []) as MockPaper[]); setTotal(paperResult.count ?? 0)
        const available = (examResult.data as { exam: string }[]).map(row => row.exam)
        setExams(Array.from(new Set(["GATE", exam, ...available])).sort())
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [exam, filter, page, revision, supabase])
  useEffect(() => { void loadHistory() }, [loadHistory, revision])

  const startPaper = async (paper: MockPaper) => {
    setStartingPaperId(paper.id); setPaperToStart(null)
    const { data, error } = await supabase.rpc("start_mock_exam", { p_paper_id: paper.id })
    setStartingPaperId(null)
    if (error) { toast.error("Couldn’t start the test", { description: mockError(error) }); return }
    setActiveAttempt(data as MockAttempt); void loadHistory()
  }
  const openAttempt = async (id: string) => {
    setOpeningAttemptId(id)
    const { data, error } = await supabase.rpc("get_mock_exam", { p_attempt_id: id })
    setOpeningAttemptId(null)
    if (error) { toast.error("Couldn’t open this attempt", { description: mockError(error) }); return }
    setActiveAttempt(data as MockAttempt); void loadHistory()
  }
  const closeAttempt = () => { setActiveAttempt(null); void loadHistory() }

  const completedAttempts = attempts.filter(attempt => attempt.status === "completed" && attemptPercentage(attempt) !== null)
  const percentages = completedAttempts.map(attempt => attemptPercentage(attempt) as number)
  const average = percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null
  const best = percentages.length ? Math.max(...percentages) : null

  if (activeAttempt) return <ExamRunner key={activeAttempt.id} initialAttempt={activeAttempt} onAttemptChange={setActiveAttempt} onExit={closeAttempt} onRetake={() => {
    if (!activeAttempt.paper_id) return
    const paper = papers.find(item => item.id === activeAttempt.paper_id) ?? { id: activeAttempt.paper_id, title: activeAttempt.title, exam: activeAttempt.exam, year: activeAttempt.year, subject: "", duration_minutes: activeAttempt.duration_minutes, question_count: activeAttempt.questions.length }
    void startPaper(paper)
  }} retaking={startingPaperId === activeAttempt.paper_id} />

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">Mock tests</h2><Badge className="gap-1"><Zap className="h-3 w-3" />Up to 2,500 EXP</Badge></div><p className="mt-1 text-sm text-muted-foreground">Timed mock tests give the biggest EXP boost. Higher scores and new personal bests earn more.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}><FileJson />Import guide</Button></div></div>

      {completedAttempts.length > 0 && <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2"><History className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-semibold tabular-nums">{completedAttempts.length}</p><p className="text-xs text-muted-foreground">Tests completed</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2"><BarChart3 className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-semibold tabular-nums">{average?.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Average score</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2"><Target className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-semibold tabular-nums">{best?.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Best score</p></div></CardContent></Card></div>}

      {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm"><p className="font-medium">Couldn’t load mock tests</p><p className="mt-2 text-muted-foreground">{error}</p></div>}
      <div className="grid max-w-2xl gap-4 sm:grid-cols-[180px_minmax(0,1fr)]"><div className="space-y-2"><Label htmlFor="mock-exam">Exam</Label><Select value={exam} onValueChange={value => { setExam(value); setPage(0) }}><SelectTrigger id="mock-exam"><SelectValue placeholder="Select an exam" /></SelectTrigger><SelectContent>{exams.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="mock-search">Search papers</Label><Input id="mock-search" placeholder={`e.g. ${exam} 2025`} value={search} onChange={event => setSearch(event.target.value)} /></div></div>

      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading papers…</div> : papers.length === 0 ? <Card><CardContent className="py-14 text-center"><BookOpen className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">{filter ? "No matching papers" : `No ${exam} papers yet`}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{filter ? "Try a different search." : "Import a question paper to make it available as a timed mock test."}</p>{!filter && <Button variant="outline" className="mt-5" onClick={() => setGuideOpen(true)}>Open import guide</Button>}</CardContent></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{papers.map(paper => {
          const inProgress = attempts.find(attempt => attempt.paper_id === paper.id && attempt.status === "in_progress")
          return <Card key={paper.id} className="flex flex-col"><CardHeader className="flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="secondary">{paper.year}</Badge><Badge variant="outline">{paper.exam}</Badge>{inProgress && <Badge>In progress</Badge>}</div><CardTitle className="break-words">{paper.title}</CardTitle><CardDescription>{paper.subject || "All subjects"}</CardDescription></CardHeader><CardContent><div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{paper.question_count} questions</span><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{paper.duration_minutes} min</span></div>{inProgress ? <Button className="w-full" onClick={() => void openAttempt(inProgress.id)} disabled={openingAttemptId === inProgress.id}>{openingAttemptId === inProgress.id ? <Loader2 className="animate-spin" /> : <Play />}Resume test</Button> : <Button className="w-full" variant="outline" onClick={() => setPaperToStart(paper)} disabled={startingPaperId === paper.id}>{startingPaperId === paper.id ? <Loader2 className="animate-spin" /> : <Play />}Start test</Button>}</CardContent></Card>
        })}</div>
      )}
      {!loading && total > PAGE_SIZE && <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} papers</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft />Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next<ChevronRight /></Button></div></div>}

      <section className="space-y-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5" />Your attempts</h3><p className="mt-1 text-sm text-muted-foreground">Results are saved to your account and included in performance analysis.</p></div>{historyLoading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading attempts…</div> : attempts.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Your completed and active tests will appear here.</CardContent></Card> : <Card><CardContent className="divide-y p-0">{attempts.map(attempt => {
        const percentage = attemptPercentage(attempt); const active = attempt.status === "in_progress"
        return <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{attempt.title}</p><p className="mt-1 text-xs text-muted-foreground">{attempt.exam} · Started {new Date(attempt.started_at).toLocaleString()}</p></div><div className="flex items-center gap-3">{active ? <Badge>In progress</Badge> : <div className="text-right"><p className="font-semibold tabular-nums">{Number(attempt.score).toFixed(2)} / {Number(attempt.total_marks).toFixed(2)}</p><p className="text-xs text-muted-foreground">{percentage?.toFixed(1)}% · <span className="text-amber-600 dark:text-amber-400">+{attempt.exp_gained.toLocaleString()} EXP</span>{attempt.is_personal_best && " · PB"}</p></div>}<Button variant="outline" size="sm" disabled={openingAttemptId === attempt.id} onClick={() => void openAttempt(attempt.id)}>{openingAttemptId === attempt.id ? <Loader2 className="animate-spin" /> : active ? <Play /> : <Eye />}{active ? "Resume" : "View result"}</Button></div></div>
      })}</CardContent></Card>}</section>

      <AlertDialog open={Boolean(paperToStart)} onOpenChange={open => { if (!open) setPaperToStart(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Start timed mock test?</AlertDialogTitle><AlertDialogDescription>{paperToStart?.title} has {paperToStart?.question_count} questions and a {paperToStart?.duration_minutes}-minute limit. The timer starts immediately and continues if you leave this page. Answers and explanations appear after submission.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); if (paperToStart) void startPaper(paperToStart) }}><Play />Start test</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}><DialogContent><DialogHeader><DialogTitle>Import a mock paper with AI</DialogTitle><DialogDescription>Add a validated paper once, then every signed-in user can take it as a timed test.</DialogDescription></DialogHeader><ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed"><li>Give your AI the question paper and answer key. Ask it to follow <code className="break-all text-xs">docs/mock-question-bank.md</code>.</li><li>Set the exam, year, duration, marks, negative marks, and answer keys accurately.</li><li>Run the importer. The paper will become available here after refresh.</li></ol><Button asChild variant="outline"><a href="/mock-paper.example.json" download><Download />Download example JSON</a></Button></DialogContent></Dialog>
    </div>
  )
}

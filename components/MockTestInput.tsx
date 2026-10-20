"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Trophy,
  Loader2,
  Zap,
  TrendingUp,
  Clock,
  Target,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Database,
  Layers,
} from "lucide-react"
import {
  useMockTests,
  mockTestExp,
  MOCK_BASE_EXP,
  MOCK_MAX_BONUS_EXP,
  SETUP_SQL,
  type ExamType,
} from "@/hooks/useMockTests"

const POPULAR_PLATFORMS = [
  "Testbook",
  "Made Easy",
  "ACE Academy",
  "Unacademy",
  "Applied Gate",
  "PhysicsWallah",
  "Other",
]

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  full_paper: "Full Paper",
  subject_wise: "Subject-Wise",
  topic_test: "Topic Test",
}

export function MockTestInput({ soundEnabled }: { soundEnabled: boolean }) {
  const { exams, attempts, loading, error, addExam, removeExam, recordAttempt, bestScores, reload } =
    useMockTests()

  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [marks, setMarks] = useState("")
  const [creating, setCreating] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [showSqlDialog, setShowSqlDialog] = useState(false)

  // New exam creation fields
  const [newExamName, setNewExamName] = useState("")
  const [newExamType, setNewExamType] = useState<ExamType>("full_paper")
  const [newExamSubject, setNewExamSubject] = useState("")
  const [newExamPlatform, setNewExamPlatform] = useState("Testbook")
  const [newExamMarks, setNewExamMarks] = useState("100")

  // Attempt metrics
  const [showMetrics, setShowMetrics] = useState(false)
  const [hoursSpent, setHoursSpent] = useState("")
  const [minutesSpent, setMinutesSpent] = useState("")
  const [totalQuestions, setTotalQuestions] = useState("")
  const [questionsAttempted, setQuestionsAttempted] = useState("")
  const [questionsCorrect, setQuestionsCorrect] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null
  const marksNum = Number.parseFloat(marks) || 0

  // Live EXP preview
  const previewExp = (() => {
    if (!selectedExam || marks === "" || marksNum < 0 || marksNum > selectedExam.totalMarks) return null
    const pct = (marksNum / selectedExam.totalMarks) * 100
    const prevBest = attempts
      .filter((a) => a.examId === selectedExam.id)
      .reduce((max, a) => Math.max(max, a.scorePct), -1)
    return mockTestExp(pct, pct > prevBest)
  })()

  // Live accuracy preview
  const attemptedCount = Number.parseInt(questionsAttempted) || 0
  const correctCount = Number.parseInt(questionsCorrect) || 0
  const incorrectCount = Math.max(0, attemptedCount - correctCount)
  const liveAccuracy =
    attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : null

  const handleCopySql = () => {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopiedSql(true)
    toast.success("SQL script copied to clipboard!", {
      description: "Paste and run this in your Supabase SQL Editor.",
    })
    setTimeout(() => setCopiedSql(false), 2500)
  }

  const handleCreateExam = async () => {
    if (!newExamName.trim()) {
      toast.error("Please enter an exam name")
      return
    }
    const total = Number.parseFloat(newExamMarks) || 100
    if (total <= 0) {
      toast.error("Total marks must be greater than 0")
      return
    }

    const exam = await addExam(newExamName.trim(), total, {
      examType: newExamType,
      subject: newExamSubject.trim() || undefined,
      platform: newExamPlatform.trim() || undefined,
    })

    if (exam) {
      setSelectedExamId(exam.id)
      toast.success(`Exam created: ${exam.name}`, {
        description: `${EXAM_TYPE_LABELS[exam.examType]} · Out of ${exam.totalMarks} marks`,
      })
      setNewExamName("")
      setNewExamSubject("")
      setNewExamMarks(newExamType === "full_paper" ? "100" : "50")
      setCreating(false)
    } else {
      toast.error("Could not create exam — it may already exist")
    }
  }

  const handleRecord = async () => {
    if (!selectedExam || marks === "" || marksNum < 0 || marksNum > selectedExam.totalMarks) {
      toast.error(`Marks must be between 0 and ${selectedExam?.totalMarks ?? "?"}`)
      return
    }

    const totalMinutes =
      (Number.parseInt(hoursSpent) || 0) * 60 + (Number.parseInt(minutesSpent) || 0)

    setSubmitting(true)
    const exp = await recordAttempt(selectedExam.id, marksNum, {
      timeSpentMinutes: totalMinutes > 0 ? totalMinutes : null,
      totalQuestions: totalQuestions ? Number.parseInt(totalQuestions) : null,
      questionsAttempted: questionsAttempted ? Number.parseInt(questionsAttempted) : null,
      questionsCorrect: questionsCorrect ? Number.parseInt(questionsCorrect) : null,
      questionsIncorrect: questionsAttempted ? incorrectCount : null,
      notes: notes.trim() || null,
    })
    setSubmitting(false)

    if (exp > 0) {
      const pct = ((marksNum / selectedExam.totalMarks) * 100).toFixed(1)
      toast.success(`+${exp} EXP — ${pct}% on ${selectedExam.name}`, {
        description: liveAccuracy ? `Accuracy: ${liveAccuracy}%` : undefined,
      })
      setMarks("")
      setHoursSpent("")
      setMinutesSpent("")
      setTotalQuestions("")
      setQuestionsAttempted("")
      setQuestionsCorrect("")
      setNotes("")
      setShowMetrics(false)
    } else {
      toast.error("Could not save the attempt")
    }
  }

  const best = bestScores()

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] via-transparent to-rose-500/[0.03] pointer-events-none" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-400" />
            Mock Tests Logger
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            {MOCK_BASE_EXP}–{MOCK_BASE_EXP + MOCK_MAX_BONUS_EXP} EXP · PB ×1.5
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Log mock test scores from external platforms (Testbook, Made Easy, etc.). Track full papers,
          subject-wise tests, hours spent, score, and accuracy.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-left space-y-3">
            <div className="flex items-start gap-2.5">
              <Database className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Database Setup Required
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The personal mock test tables (<code className="font-mono text-amber-400">user_mock_exams</code>) need to be initialized in your Supabase project.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={handleCopySql}>
                {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSql ? "Copied SQL!" : "Copy SQL Script"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setShowSqlDialog(!showSqlDialog)}
              >
                {showSqlDialog ? "Hide SQL" : "View SQL"}
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs ml-auto" onClick={reload}>
                Check Again
              </Button>
            </div>

            {showSqlDialog && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/60 p-3 text-[11px] font-mono text-zinc-300 border border-border">
                {SETUP_SQL}
              </pre>
            )}
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Loading mock test history...
          </div>
        ) : (
          <>
            {/* Exam selector + marks input */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Select Exam</Label>
                <div className="flex gap-2">
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          <span className="font-medium">{exam.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            ({EXAM_TYPE_LABELS[exam.examType] || "Full"} · /{exam.totalMarks})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant={creating ? "secondary" : "outline"}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setCreating(!creating)}
                    title={creating ? "Close form" : "Create new exam"}
                  >
                    {creating ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* New exam creation form */}
              <AnimatePresence>
                {creating && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden rounded-xl border border-dashed p-3.5 bg-muted/20"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-amber-400" />
                        Create New Exam Tracker
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        Custom Platform Log
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="exam-name" className="text-xs">
                          Exam Name
                        </Label>
                        <Input
                          id="exam-name"
                          autoFocus
                          placeholder="e.g. GATE CS Full Mock 1 or DBMS Subject Test"
                          value={newExamName}
                          onChange={(e) => setNewExamName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={newExamType}
                          onValueChange={(val: ExamType) => {
                            setNewExamType(val)
                            if (val === "full_paper") setNewExamMarks("100")
                            else if (newExamMarks === "100") setNewExamMarks("50")
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_paper">Full Paper (100 Marks)</SelectItem>
                            <SelectItem value="subject_wise">Subject-Wise</SelectItem>
                            <SelectItem value="topic_test">Topic Test</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Platform</Label>
                        <Select value={newExamPlatform} onValueChange={setNewExamPlatform}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POPULAR_PLATFORMS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {newExamType !== "full_paper" && (
                        <div className="space-y-1">
                          <Label htmlFor="exam-subject" className="text-xs">
                            Subject
                          </Label>
                          <Input
                            id="exam-subject"
                            placeholder="e.g. Operating Systems"
                            value={newExamSubject}
                            onChange={(e) => setNewExamSubject(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor="exam-marks" className="text-xs">
                          Total Marks
                        </Label>
                        <Input
                          id="exam-marks"
                          type="number"
                          min={1}
                          placeholder="100"
                          value={newExamMarks}
                          onChange={(e) => setNewExamMarks(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button type="button" size="sm" onClick={handleCreateExam}>
                        Create Exam
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCreating(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Marks input + attempt metrics */}
              {selectedExam && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="rounded-lg border bg-muted/10 p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {selectedExam.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {selectedExam.platform && (
                          <Badge variant="secondary" className="text-[10px]">
                            {selectedExam.platform}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {EXAM_TYPE_LABELS[selectedExam.examType] || "Full Paper"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="marks" className="text-xs">
                        Marks Obtained (out of {selectedExam.totalMarks})
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="marks"
                          type="number"
                          min={0}
                          max={selectedExam.totalMarks}
                          step="0.25"
                          placeholder="e.g. 68.5"
                          value={marks}
                          onChange={(e) => setMarks(e.target.value)}
                          className="text-sm font-semibold"
                        />
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          / {selectedExam.totalMarks}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible section for hours and accuracy */}
                    <div className="border-t pt-2">
                      <button
                        type="button"
                        onClick={() => setShowMetrics(!showMetrics)}
                        className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground py-1 font-medium transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          Hours taken, Accuracy & Notes
                        </span>
                        {showMetrics ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <AnimatePresence>
                        {showMetrics && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2.5 pt-2 overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor="hours" className="text-[11px] text-muted-foreground">
                                  Hours
                                </Label>
                                <Input
                                  id="hours"
                                  type="number"
                                  min={0}
                                  max={10}
                                  placeholder="e.g. 2"
                                  value={hoursSpent}
                                  onChange={(e) => setHoursSpent(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="minutes" className="text-[11px] text-muted-foreground">
                                  Minutes
                                </Label>
                                <Input
                                  id="minutes"
                                  type="number"
                                  min={0}
                                  max={59}
                                  placeholder="e.g. 45"
                                  value={minutesSpent}
                                  onChange={(e) => setMinutesSpent(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor="total-q" className="text-[11px] text-muted-foreground">
                                  Total Qs
                                </Label>
                                <Input
                                  id="total-q"
                                  type="number"
                                  min={1}
                                  placeholder="65"
                                  value={totalQuestions}
                                  onChange={(e) => setTotalQuestions(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="attempted-q" className="text-[11px] text-muted-foreground">
                                  Attempted
                                </Label>
                                <Input
                                  id="attempted-q"
                                  type="number"
                                  min={0}
                                  placeholder="50"
                                  value={questionsAttempted}
                                  onChange={(e) => setQuestionsAttempted(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="correct-q" className="text-[11px] text-muted-foreground">
                                  Correct
                                </Label>
                                <Input
                                  id="correct-q"
                                  type="number"
                                  min={0}
                                  placeholder="42"
                                  value={questionsCorrect}
                                  onChange={(e) => setQuestionsCorrect(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>

                            {liveAccuracy !== null && (
                              <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Target className="h-3 w-3 text-cyan-400" />
                                  Live Accuracy:
                                </span>
                                <span className="font-mono font-bold text-cyan-400">
                                  {liveAccuracy}% ({correctCount}/{attemptedCount} correct, {incorrectCount} wrong)
                                </span>
                              </div>
                            )}

                            <div className="space-y-1">
                              <Label htmlFor="attempt-notes" className="text-[11px] text-muted-foreground">
                                Remarks / Mistakes Analyzed
                              </Label>
                              <Input
                                id="attempt-notes"
                                placeholder="e.g. Silly calculation error in Q12, need to revise Paging"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {previewExp !== null && (
                      <motion.div
                        key={previewExp}
                        initial={{ scale: 1.02 }}
                        animate={{ scale: 1 }}
                        className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2"
                      >
                        <span className="text-xs text-muted-foreground">
                          {((marksNum / selectedExam.totalMarks) * 100).toFixed(1)}% score
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold font-mono text-amber-400">
                          <Zap className="h-3.5 w-3.5" />+{previewExp} EXP
                        </span>
                      </motion.div>
                    )}

                    <Button
                      type="button"
                      className="w-full"
                      disabled={
                        submitting ||
                        marks === "" ||
                        marksNum < 0 ||
                        marksNum > selectedExam.totalMarks
                      }
                      onClick={handleRecord}
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trophy className="mr-2 h-4 w-4" />
                      )}
                      Save Attempt
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Per-exam best scores */}
            {best.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Your Configured Exams
                </p>
                {best.map(({ exam, attemptCount, bestPct, latestPct }) => (
                  <div
                    key={exam.id}
                    className="group flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{exam.name}</p>
                        {exam.platform && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">
                            {exam.platform}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {EXAM_TYPE_LABELS[exam.examType] || "Full"} · {attemptCount} attempt{attemptCount !== 1 ? "s" : ""}
                        {latestPct !== null && ` · latest ${latestPct.toFixed(0)}%`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bestPct !== null && (
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${
                            bestPct >= 75
                              ? "border-emerald-500/40 text-emerald-400"
                              : bestPct >= 50
                                ? "border-amber-500/40 text-amber-400"
                                : "border-red-500/40 text-red-400"
                          }`}
                        >
                          best {bestPct.toFixed(0)}%
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExam(exam.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                        title="Delete exam"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent attempts */}
            {attempts.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Recent Logged Attempts
                </p>
                <div className="space-y-1.5">
                  {attempts.slice(0, 5).map((attempt) => (
                    <div
                      key={attempt.id}
                      className="rounded-lg border bg-muted/10 p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">
                          {attempt.examName}
                        </span>
                        <span className="flex items-center gap-2 font-mono shrink-0">
                          <span className="font-semibold text-foreground">
                            {attempt.marksObtained}/{attempt.totalMarks}
                          </span>
                          <span className="text-amber-400">+{attempt.expGained} EXP</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                        <span>{attempt.scorePct.toFixed(1)}% score</span>
                        {attempt.accuracyPct !== null && (
                          <span className="text-cyan-400 font-mono">
                            · {attempt.accuracyPct.toFixed(0)}% acc
                          </span>
                        )}
                        {attempt.timeSpentMinutes && (
                          <span className="flex items-center gap-0.5">
                            · <Clock className="h-2.5 w-2.5 inline" />
                            {Math.floor(attempt.timeSpentMinutes / 60)}h {attempt.timeSpentMinutes % 60}m
                          </span>
                        )}
                        {attempt.platform && <span>· {attempt.platform}</span>}
                      </div>
                      {attempt.notes && (
                        <p className="text-[10px] text-muted-foreground italic border-t pt-1">
                          &quot;{attempt.notes}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exams.length === 0 && !loading && (
              <div className="py-4 text-center">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No exams configured yet — tap <Plus className="inline h-3 w-3" /> to add your first mock test.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

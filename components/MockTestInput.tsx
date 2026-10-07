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
} from "lucide-react"
import {
  useMockTests,
  mockTestExp,
  MOCK_BASE_EXP,
  MOCK_MAX_BONUS_EXP,
  type MockExam,
} from "@/hooks/useMockTests"

export function MockTestInput({ soundEnabled }: { soundEnabled: boolean }) {
  const { exams, attempts, loading, error, addExam, removeExam, recordAttempt, bestScores } =
    useMockTests()

  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [marks, setMarks] = useState("")
  const [creating, setCreating] = useState(false)
  const [newExamName, setNewExamName] = useState("")
  const [newExamMarks, setNewExamMarks] = useState("100")
  const [submitting, setSubmitting] = useState(false)

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null
  const marksNum = Number.parseFloat(marks) || 0

  // Live EXP preview
  const previewExp = (() => {
    if (!selectedExam || marks <= 0 || marksNum > selectedExam.totalMarks) return null
    const pct = (marksNum / selectedExam.totalMarks) * 100
    const prevBest = attempts
      .filter((a) => a.examId === selectedExam.id)
      .reduce((max, a) => Math.max(max, a.scorePct), -1)
    return mockTestExp(pct, pct > prevBest)
  })()

  const handleCreateExam = async () => {
    if (!newExamName.trim()) return
    const total = Number.parseInt(newExamMarks) || 100
    if (total <= 0) {
      toast.error("Total marks must be greater than 0")
      return
    }

    const exam = await addExam(newExamName.trim(), total)
    if (exam) {
      setSelectedExamId(exam.id)
      toast.success(`Exam created: ${exam.name}`, {
        description: `Out of ${exam.totalMarks} marks`,
      })
      setNewExamName("")
      setNewExamMarks("100")
      setCreating(false)
    } else {
      toast.error("Could not create exam — it may already exist")
    }
  }

  const handleRecord = async () => {
    if (!selectedExam || marksNum < 0 || marksNum > selectedExam.totalMarks) {
      toast.error(`Marks must be between 0 and ${selectedExam?.totalMarks ?? "?"}`)
      return
    }

    setSubmitting(true)
    const exp = await recordAttempt(selectedExam.id, marksNum)
    setSubmitting(false)

    if (exp > 0) {
      const pct = ((marksNum / selectedExam.totalMarks) * 100).toFixed(1)
      toast.success(`+${exp} EXP — ${pct}% on ${selectedExam.name}`)
      setMarks("")
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
            Mock Tests
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            {MOCK_BASE_EXP}–{MOCK_BASE_EXP + MOCK_MAX_BONUS_EXP} EXP · PB ×1.5
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Log your mock test scores. Higher scores earn more EXP — beating your
          personal best on an exam pays out ×1.5.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-4 text-center">
            <p className="text-sm font-medium text-red-400 mb-1">Couldn&apos;t load mock tests</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            {/* Exam selector + marks input */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Exam</Label>
                <div className="flex gap-2">
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.name} · /{exam.totalMarks}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setCreating(!creating)}
                    title="Create new exam"
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
                    className="space-y-2 overflow-hidden rounded-lg border border-dashed p-3"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-name">Exam name</Label>
                      <Input
                        id="exam-name"
                        autoFocus
                        placeholder="e.g. GATE CS Full Mock 1"
                        value={newExamName}
                        onChange={(e) => setNewExamName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleCreateExam()
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-marks">Total marks</Label>
                      <Input
                        id="exam-marks"
                        type="number"
                        min={1}
                        placeholder="100"
                        value={newExamMarks}
                        onChange={(e) => setNewExamMarks(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleCreateExam}>
                        Create exam
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

              {/* Marks input + preview */}
              {selectedExam && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="marks">
                      Marks obtained (out of {selectedExam.totalMarks})
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="marks"
                        type="number"
                        min={0}
                        max={selectedExam.totalMarks}
                        step="0.5"
                        placeholder="e.g. 62"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground font-mono shrink-0">
                        / {selectedExam.totalMarks}
                      </span>
                    </div>
                  </div>

                  {previewExp !== null && (
                    <motion.div
                      key={previewExp}
                      initial={{ scale: 1.05 }}
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
                    disabled={submitting || marks === "" || marksNum < 0 || marksNum > selectedExam.totalMarks}
                    onClick={handleRecord}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trophy className="mr-2 h-4 w-4" />
                    )}
                    Save attempt
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Per-exam best scores */}
            {best.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Your exams
                </p>
                {best.map(({ exam, attemptCount, bestPct, latestPct }) => (
                  <div
                    key={exam.id}
                    className="group flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exam.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {attemptCount} attempt{attemptCount !== 1 ? "s" : ""}
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
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Recent attempts
                </p>
                {attempts.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate text-muted-foreground">
                      {attempt.examName} — {attempt.marksObtained}/{attempt.totalMarks}
                    </span>
                    <span className="flex items-center gap-2 font-mono shrink-0">
                      <span className="text-muted-foreground">
                        {attempt.scorePct.toFixed(0)}%
                      </span>
                      <span className="text-amber-400">+{attempt.expGained}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {exams.length === 0 && !loading && (
              <div className="py-4 text-center">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No exams yet — tap <Plus className="inline h-3 w-3" /> to create your
                  first mock test.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

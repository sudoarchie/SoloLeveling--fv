"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  BookOpen,
  Plus,
  Check,
  X,
  Trash2,
  Clock,
  Trophy,
  CalendarClock,
} from "lucide-react"
import {
  useSpacedRepetition,
  REVIEW_INTERVALS,
  REVIEWS_TO_MASTER,
  type RevisionTopic,
} from "@/hooks/useSpacedRepetition"
import { useSoundEffects } from "@/hooks/useSoundEffects"

interface RevisionTopicsProps {
  spaced: ReturnType<typeof useSpacedRepetition>
}

// Stage colors — progress along the forgetting curve
const STAGE_COLORS = [
  "text-red-400 border-red-500/30 bg-red-500/[0.06]", // 1d — weakest
  "text-orange-400 border-orange-500/30 bg-orange-500/[0.06]", // 3d
  "text-blue-400 border-blue-500/30 bg-blue-500/[0.06]", // 7d
  "text-cyan-400 border-cyan-500/30 bg-cyan-500/[0.06]", // 21d — almost there
]

function formatDue(dateStr: string) {
  const days = Math.round((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (days <= 0) return "Due now"
  if (days === 1) return "Tomorrow"
  return `In ${days} days`
}

function TopicRow({
  topic,
  onComplete,
  onRemove,
}: {
  topic: RevisionTopic
  onComplete: (id: string, success: boolean) => void
  onRemove: (id: string) => void
}) {
  const sounds = useSoundEffects()
  const stageStyle = STAGE_COLORS[Math.min(topic.stage, STAGE_COLORS.length - 1)]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-lg border p-3 ${stageStyle}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{topic.name}</p>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {topic.subject}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Progress
              value={(topic.reviewCount / REVIEWS_TO_MASTER) * 100}
              className="h-1.5 flex-1"
            />
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
              review {topic.reviewCount}/{REVIEWS_TO_MASTER}
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {topic.mastered ? "Mastered" : formatDue(topic.nextReviewDate)}
            {!topic.mastered && topic.stage < REVIEW_INTERVALS.length && (
              <span className="ml-1 opacity-70">
                • next gap: {REVIEW_INTERVALS[topic.stage]}d
              </span>
            )}
          </p>
        </div>
        {!topic.mastered && (
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                title="I remembered it"
                onClick={() => {
                  sounds.buttonClick()
                  onComplete(topic.id, true)
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-red-400 border-red-500/40 hover:bg-red-500/10"
                title="I forgot it"
                onClick={() => {
                  sounds.buttonClick()
                  onComplete(topic.id, false)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-muted-foreground hover:text-red-400"
              title="Remove topic"
              onClick={() => onRemove(topic.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
        {topic.mastered && (
          <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40">
            <Trophy className="h-4 w-4 text-emerald-400" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function RevisionTopics({ spaced }: RevisionTopicsProps) {
  const {
    topics,
    dueTopics,
    upcomingTopics,
    masteredTopics,
    loading,
    masterCelebration,
    addTopic,
    removeTopic,
    completeReview,
  } = spaced

  const [newTopic, setNewTopic] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const sounds = useSoundEffects()

  const handleAdd = () => {
    if (!newTopic.trim()) return
    sounds.formSubmit()
    addTopic(newTopic, newSubject)
    setNewTopic("")
    setNewSubject("")
    setDialogOpen(false)
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] via-transparent to-cyan-500/[0.03] pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-red-400" />
              Weak Topics — Spaced Revision
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Topic
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Add a weak topic</DialogTitle>
                  <DialogDescription>
                    It will come back for review on a proven schedule: 1 → 3 → 7 → 21 days.
                    Four successful reviews and it&apos;s mastered.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Topic name</label>
                    <Input
                      placeholder="e.g. Integration by parts"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Subject (optional)</label>
                    <Input
                      placeholder="e.g. Mathematics"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                  </div>
                  <Button className="w-full" onClick={handleAdd} disabled={!newTopic.trim()}>
                    Add Topic
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Reviews are scheduled by the forgetting curve — recall right before you forget
            strengthens memory the most.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="h-6 w-6 mx-auto mb-2 animate-pulse" />
              Loading topics...
            </div>
          ) : topics.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No topics yet. Add the topics you keep forgetting — the schedule does the rest.
              </p>
            </div>
          ) : (
            <>
              {/* Due now */}
              {dueTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Due for review ({dueTopics.length})
                  </p>
                  <AnimatePresence>
                    {dueTopics.map((topic) => (
                      <TopicRow
                        key={topic.id}
                        topic={topic}
                        onComplete={completeReview}
                        onRemove={removeTopic}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Upcoming */}
              {upcomingTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Scheduled ({upcomingTopics.length})
                  </p>
                  <AnimatePresence>
                    {upcomingTopics.map((topic) => (
                      <TopicRow
                        key={topic.id}
                        topic={topic}
                        onComplete={completeReview}
                        onRemove={removeTopic}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Mastered */}
              {masteredTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    Mastered ({masteredTopics.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {masteredTopics.map((topic) => (
                      <Badge
                        key={topic.id}
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-400 text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {topic.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Mastery celebration */}
      <AnimatePresence>
        {masterCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              transition={{ type: "spring", damping: 15 }}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/50 bg-card px-5 py-4 shadow-xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                <Trophy className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Topic mastered!</p>
                <p className="text-xs text-muted-foreground">
                  {masterCelebration} — 4 successful reviews. It&apos;s yours now.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

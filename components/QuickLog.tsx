"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Zap,
  Plus,
  Minus,
  Sparkles,
  BookOpen,
  PenLine,
  Sunrise,
  Dumbbell,
  Send,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useSoundEffects } from "@/hooks/useSoundEffects"

export interface QuickLogData {
  lecturesCompleted: number
  topicsRevised: number
  practiceHours: number
  morningSession: boolean
  exerciseDone: boolean
  distractionsLevel: string
  mentalState: string
}

interface QuickLogProps {
  onSubmit: (data: QuickLogData) => void
  /** Topics due for review — shown as one-tap chips */
  dueTopicNames: string[]
  /** Called when a due topic chip is tapped (marks review done) */
  onTopicReviewed?: (name: string, success: boolean) => void
  /** Called when a new weak topic is added inline */
  onAddTopic?: (name: string) => void
  soundEnabled: boolean
}

const DISTRACTION_OPTIONS = [
  { value: "None", label: "Focused", exp: "+0" },
  { value: "Low", label: "Slightly distracted", exp: "-20" },
  { value: "Medium", label: "Distracted", exp: "-50" },
  { value: "High", label: "Very distracted", exp: "-100" },
]

export function calculateQuickLogExp(data: QuickLogData): number {
  let exp = 0
  exp += data.lecturesCompleted * 50
  exp += data.topicsRevised * 30
  exp += data.practiceHours * 100
  exp += data.morningSession ? 50 : 0
  exp += data.exerciseDone ? 30 : 0
  const penalty = { None: 0, Low: -20, Medium: -50, High: -100 } as Record<string, number>
  exp += penalty[data.distractionsLevel] || 0
  return Math.max(0, exp)
}

// One tappable counter row — tap the number itself to increment
function Counter({
  icon: Icon,
  label,
  value,
  step,
  onChange,
  expPerUnit,
  soundEnabled,
}: {
  icon: any
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  expPerUnit: number
  soundEnabled: boolean
}) {
  const sounds = useSoundEffects()
  const bump = (delta: number) => {
    onChange(Math.max(0, Math.round((value + delta) * 10) / 10))
    if (soundEnabled) sounds.buttonClick()
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <p className="text-[10px] font-mono text-muted-foreground">
            +{Math.round(value * expPerUnit)} EXP
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => bump(-step)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={() => bump(step)}
          className="min-w-[2.5rem] rounded-md border px-2 py-1 text-center text-sm font-bold font-mono hover:bg-accent transition-colors"
          title={`Tap to add ${step}`}
        >
          {value}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => bump(step)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function QuickLog({ onSubmit, dueTopicNames, onTopicReviewed, onAddTopic, soundEnabled }: QuickLogProps) {
  const [data, setData] = useState<QuickLogData>({
    lecturesCompleted: 0,
    topicsRevised: 0,
    practiceHours: 0,
    morningSession: false,
    exerciseDone: false,
    distractionsLevel: "None",
    mentalState: "",
  })
  const [newTopic, setNewTopic] = useState("")
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [reviewedTopics, setReviewedTopics] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const sounds = useSoundEffects()

  const totalExp = useMemo(() => calculateQuickLogExp(data), [data])

  const set = <K extends keyof QuickLogData>(key: K, value: QuickLogData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(data)
    setData({
      lecturesCompleted: 0,
      topicsRevised: 0,
      practiceHours: 0,
      morningSession: false,
      exerciseDone: false,
      distractionsLevel: "None",
      mentalState: "",
    })
    setReviewedTopics(new Set())
    setShowNewTopic(false)
    setNewTopic("")
  }

  const handleTopicChip = (name: string) => {
    if (reviewedTopics.has(name)) return
    setReviewedTopics((prev) => new Set(prev).add(name))
    onTopicReviewed?.(name, true)
    // Counting a review also counts as a revised topic
    set("topicsRevised", data.topicsRevised + 1)
    if (soundEnabled) sounds.buttonClick()
  }

  const handleAddTopicInline = () => {
    if (!newTopic.trim()) return
    onAddTopic?.(newTopic.trim())
    toast.success(`Topic added: ${newTopic.trim()}`, {
      description: "It'll come back for review on the 1-3-7-21 day schedule",
    })
    setNewTopic("")
    setShowNewTopic(false)
    if (soundEnabled) sounds.formSubmit()
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-cyan-500/[0.04] pointer-events-none" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Log Today
          </CardTitle>
          <Badge variant={totalExp > 0 ? "default" : "outline"} className="font-mono">
            +{totalExp} EXP
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tap numbers to count up. Everything is optional — log what you did.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Due topic chips — one tap = review done */}
          {(dueTopicNames.length > 0 || showNewTopic) && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-3 space-y-2">
              <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Reviews due today ({dueTopicNames.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dueTopicNames.map((name) => {
                  const done = reviewedTopics.has(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={done}
                      onClick={() => handleTopicChip(name)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        done
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 line-through"
                          : "border-red-500/40 bg-background text-foreground hover:bg-red-500/10 hover:border-red-500/60"
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
                {!showNewTopic && (
                  <button
                    type="button"
                    onClick={() => setShowNewTopic(true)}
                    className="rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                  >
                    + add topic
                  </button>
                )}
              </div>
              <AnimatePresence>
                {showNewTopic && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 overflow-hidden"
                  >
                    <Input
                      autoFocus
                      placeholder="Topic you keep forgetting..."
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddTopicInline()
                        }
                      }}
                      className="h-9"
                    />
                    <Button type="button" size="sm" className="h-9" onClick={handleAddTopicInline}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9"
                      onClick={() => setShowNewTopic(false)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Counters — the core, zero-typing */}
          <div className="space-y-2">
            <Counter
              icon={PenLine}
              label="Practice questions"
              value={data.lecturesCompleted}
              step={1}
              expPerUnit={50}
              onChange={(v) => set("lecturesCompleted", v)}
              soundEnabled={soundEnabled}
            />
            <Counter
              icon={BookOpen}
              label="Topics revised"
              value={data.topicsRevised}
              step={1}
              expPerUnit={30}
              onChange={(v) => set("topicsRevised", v)}
              soundEnabled={soundEnabled}
            />
            <Counter
              icon={Zap}
              label="Study hours"
              value={data.practiceHours}
              step={0.5}
              expPerUnit={100}
              onChange={(v) => set("practiceHours", v)}
              soundEnabled={soundEnabled}
            />
          </div>

          {/* Quick toggles */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                set("morningSession", !data.morningSession)
                if (soundEnabled) sounds.toggleSwitch()
              }}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                data.morningSession
                  ? "border-amber-500/40 bg-amber-500/[0.06]"
                  : "hover:bg-accent/50"
              }`}
            >
              <Sunrise className={`h-4 w-4 shrink-0 ${data.morningSession ? "text-amber-400" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">Started early</p>
                <p className="text-[10px] font-mono text-muted-foreground">+50 EXP</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                set("exerciseDone", !data.exerciseDone)
                if (soundEnabled) sounds.toggleSwitch()
              }}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                data.exerciseDone
                  ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                  : "hover:bg-accent/50"
              }`}
            >
              <Dumbbell className={`h-4 w-4 shrink-0 ${data.exerciseDone ? "text-emerald-400" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">Exercised</p>
                <p className="text-[10px] font-mono text-muted-foreground">+30 EXP</p>
              </div>
            </button>
          </div>

          {/* Advanced section — collapsed by default */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> How focused were you?
              </>
            )}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <p className="text-xs font-medium text-muted-foreground">Distraction level</p>
                <div className="grid grid-cols-2 gap-2">
                  {DISTRACTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        set("distractionsLevel", opt.value)
                        if (soundEnabled) sounds.buttonClick()
                      }}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        data.distractionsLevel === opt.value
                          ? "border-primary bg-primary/10"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <p className="text-xs font-medium">{opt.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{opt.exp} EXP</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit — sticky-feeling, always visible */}
          <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={totalExp <= 0 && reviewedTopics.size === 0}>
            <Send className="h-4 w-4 mr-2" />
            {totalExp > 0 ? `Log day  +${totalExp} EXP` : "Log day"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

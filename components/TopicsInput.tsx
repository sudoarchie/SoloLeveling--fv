"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Plus, X, Sparkles, Check } from "lucide-react"
import { DIFFICULTY_MULTIPLIER, type Difficulty } from "@/hooks/useSpacedRepetition"

interface TopicsInputProps {
  /** Topics currently due for review — suggested as tappable chips */
  dueTopics: { id: string; name: string; difficulty: Difficulty }[]
  /** Selected topic names */
  value: string[]
  onChange: (topics: string[]) => void
  /** Difficulty assigned to topics logged in this entry */
  difficulty: Difficulty
  onDifficultyChange: (d: Difficulty) => void
}

const DIFFICULTY_META: Record<Difficulty, { label: string; desc: string; cls: string; activeCls: string }> = {
  easy: {
    label: "Easy",
    desc: "I know this well",
    cls: "border-emerald-500/40 text-emerald-400",
    activeCls: "border-emerald-500 bg-emerald-500/15 text-emerald-300",
  },
  medium: {
    label: "Medium",
    desc: "Somewhat shaky",
    cls: "border-amber-500/40 text-amber-400",
    activeCls: "border-amber-500 bg-amber-500/15 text-amber-300",
  },
  hard: {
    label: "Hard",
    desc: "Really struggling",
    cls: "border-red-500/40 text-red-400",
    activeCls: "border-red-500 bg-red-500/15 text-red-300",
  },
}

export function TopicsInput({
  dueTopics,
  value,
  onChange,
  difficulty,
  onDifficultyChange,
}: TopicsInputProps) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTopic = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    // Prevent duplicates (case-insensitive)
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setInput("")
      return
    }
    onChange([...value, trimmed])
    setInput("")
  }

  const removeTopic = (name: string) => {
    onChange(value.filter((v) => v !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTopic(input)
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTopic(value[value.length - 1])
    }
  }

  // Due topics not yet selected — shown as suggestions
  const dueSuggestions = dueTopics.filter(
    (t) => !value.some((v) => v.toLowerCase() === t.name.toLowerCase()),
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Topics studied today</label>
        <span className="text-[10px] font-mono text-muted-foreground">
          Enter or comma to add
        </span>
      </div>

      {/* Selected topics */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {value.map((name) => {
              const isDue = dueTopics.some((t) => t.name.toLowerCase() === name.toLowerCase())
              return (
                <motion.span
                  key={name}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    isDue
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-violet-500/40 bg-violet-500/10 text-violet-300"
                  }`}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeTopic(name)}
                    className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && addTopic(input)}
          placeholder="e.g. Integration by parts, Thermodynamics..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Difficulty selector — variable EXP for revision */}
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-violet-300 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          HOW HARD WERE THESE TOPICS? — sets your revision EXP
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => {
            const m = DIFFICULTY_META[d]
            const active = difficulty === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDifficultyChange(d)}
                className={`rounded-lg border p-2 text-left transition-colors ${
                  active ? m.activeCls : `bg-background hover:bg-accent/50 ${m.cls}`
                }`}
              >
                <p className="text-xs font-medium flex items-center gap-1">
                  {active && <Check className="h-3 w-3" />}
                  {m.label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ×{DIFFICULTY_MULTIPLIER[d]} EXP
                </p>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Harder topics earn more EXP per review — be honest!
        </p>
      </div>

      {/* Due-topic suggestions — one tap to include */}
      {dueSuggestions.length > 0 && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-2.5">
          <p className="text-[10px] font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            DUE FOR REVIEW — tap to include
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dueSuggestions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => addTopic(t.name)}
                className="rounded-full border border-emerald-500/40 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-emerald-500/15 transition-colors"
              >
                + {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Topics you log are scheduled for review: 1 → 3 → 7 → 21 days. Studying a due topic
        counts as a successful review.
      </p>
    </div>
  )
}

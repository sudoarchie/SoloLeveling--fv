"use client"

import { useRef, useState } from "react"
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useSoundEffects } from "@/hooks/useSoundEffects"
import type { Difficulty } from "@/hooks/useSpacedRepetition"

export interface ConsoleLogData {
  lecturesCompleted: number
  topicsRevised: number
  practiceHours: number
  morningSession: boolean
  exerciseDone: boolean
  distractionsLevel: string
  mentalState: string
}

interface CommandConsoleProps {
  logData: ConsoleLogData
  onLogChange: (patch: Partial<ConsoleLogData>) => void
  onLogSubmit: () => Promise<void>
  expPreview: number
  studiedTopics: string[]
  onStudiedTopicsChange: (topics: string[]) => void
  topicDifficulty: Difficulty
  onTopicDifficultyChange: (difficulty: Difficulty) => void
  hasReportToday: boolean
  soundEnabled: boolean
}

function Counter({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <Label htmlFor={`log-${label}`} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center rounded-lg border bg-background p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value === 0}
          onClick={() => onChange(Math.max(0, value - step))}
        >
          <Minus />
        </Button>
        <Input
          id={`log-${label}`}
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next))
              onChange(Math.max(0, Math.round(next / step) * step))
          }}
          className="h-9 w-14 border-0 bg-transparent p-0 text-center text-base font-semibold shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(value + step)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}

export function CommandConsole({
  logData,
  onLogChange,
  onLogSubmit,
  expPreview,
  studiedTopics,
  onStudiedTopicsChange,
  topicDifficulty,
  onTopicDifficultyChange,
  hasReportToday,
  soundEnabled,
}: CommandConsoleProps) {
  const sounds = useSoundEffects(soundEnabled)
  const [topicInput, setTopicInput] = useState("")
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const topicField = useRef<HTMLInputElement>(null)
  const addTopic = () => {
    const name = topicInput.trim()
    if (
      name &&
      !studiedTopics.some((topic) => topic.toLowerCase() === name.toLowerCase())
    ) {
      onStudiedTopicsChange([...studiedTopics, name])
    }
    setTopicInput("")
  }
  const hasActivity =
    logData.lecturesCompleted > 0 ||
    logData.topicsRevised > 0 ||
    logData.practiceHours > 0 ||
    logData.morningSession ||
    logData.exerciseDone ||
    studiedTopics.length > 0

  return (
    <Card id="daily-log">
      <CardHeader className="pb-2">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <CardTitle>Log your day</CardTitle>
        <CardDescription>
          A little progress, every day. What did you work on?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("button, summary"))
              sounds.buttonClick()
          }}
          onSubmit={async (event) => {
            event.preventDefault()
            if (submitting.current) return
            if (topicInput.trim()) {
              addTopic()
              topicField.current?.focus()
              return
            }
            if (!hasActivity) return
            sounds.unlock()
            submitting.current = true
            setSaving(true)
            try {
              await onLogSubmit()
            } finally {
              submitting.current = false
              setSaving(false)
            }
          }}
        >
          <fieldset disabled={saving} className="min-w-0">
            <div className="divide-y">
              <Counter
                label="Lectures completed"
                value={logData.lecturesCompleted}
                onChange={(value) => onLogChange({ lecturesCompleted: value })}
              />
              <Counter
                label="Topics revised"
                value={logData.topicsRevised}
                onChange={(value) => onLogChange({ topicsRevised: value })}
              />
              <Counter
                label="Practice hours"
                value={logData.practiceHours}
                step={0.5}
                onChange={(value) => onLogChange({ practiceHours: value })}
              />
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="studied-topic">Topics studied</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={topicField}
                  id="studied-topic"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Integration by parts"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addTopic()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTopic}
                  disabled={!topicInput.trim()}
                >
                  Add
                </Button>
              </div>
              {studiedTopics.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {studiedTopics.map((name) => (
                      <span
                        key={name}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary py-1 pl-3 pr-1 text-sm"
                      >
                        <span className="break-words [overflow-wrap:anywhere]">
                          {name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() =>
                            onStudiedTopicsChange(
                              studiedTopics.filter((topic) => topic !== name),
                            )
                          }
                          className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs text-muted-foreground">
                      How challenging were these topics?
                    </legend>
                    <div className="flex gap-2">
                      {(["easy", "medium", "hard"] as Difficulty[]).map(
                        (difficulty) => (
                          <Button
                            key={difficulty}
                            type="button"
                            size="sm"
                            variant={
                              topicDifficulty === difficulty
                                ? "secondary"
                                : "ghost"
                            }
                            aria-pressed={topicDifficulty === difficulty}
                            onClick={() => onTopicDifficultyChange(difficulty)}
                            className={
                              topicDifficulty === difficulty
                                ? "text-primary"
                                : "text-muted-foreground"
                            }
                          >
                            {topicDifficulty === difficulty && (
                              <Check className="h-3 w-3" />
                            )}
                            {difficulty.charAt(0).toUpperCase() +
                              difficulty.slice(1)}
                          </Button>
                        ),
                      )}
                    </div>
                  </fieldset>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  We’ll schedule these for review so they stick.
                </p>
              )}
            </div>
            <details className="group mt-6 border-t pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded py-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                Add habits & reflection
                <ChevronDown className="h-4 w-4 group-open:rotate-180" />
              </summary>
              <div className="space-y-5 pt-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="morning-session">Started early</Label>
                  <Switch
                    id="morning-session"
                    checked={logData.morningSession}
                    onCheckedChange={(morningSession) => {
                      sounds.toggleSwitch()
                      onLogChange({ morningSession })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="exercise-done">Made time for exercise</Label>
                  <Switch
                    id="exercise-done"
                    checked={logData.exerciseDone}
                    onCheckedChange={(exerciseDone) => {
                      sounds.toggleSwitch()
                      onLogChange({ exerciseDone })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focus-level">How focused were you?</Label>
                  <select
                    id="focus-level"
                    value={logData.distractionsLevel}
                    onChange={(e) =>
                      onLogChange({ distractionsLevel: e.target.value })
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="None">Focused</option>
                    <option value="Low">Slightly distracted</option>
                    <option value="Medium">Distracted</option>
                    <option value="High">Very distracted</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reflection">A note to yourself</Label>
                  <Input
                    id="reflection"
                    placeholder="What went well?"
                    value={logData.mentalState}
                    onChange={(e) =>
                      onLogChange({ mentalState: e.target.value })
                    }
                  />
                </div>
              </div>
            </details>
          </fieldset>
          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {expPreview > 0 ? (
                <>
                  <span className="font-medium text-primary">
                    +{expPreview}
                  </span>{" "}
                  EXP
                </>
              ) : (
                "Every effort counts"
              )}
            </span>
            <Button
              type="submit"
              className="h-11 px-5"
              disabled={saving || (!hasActivity && !topicInput.trim())}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {saving
                ? "Saving…"
                : hasReportToday
                  ? "Update daily log"
                  : "Save daily log"}
            </Button>
          </div>
          {hasReportToday && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              You’ve already logged today. Saving will replace today’s entry.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

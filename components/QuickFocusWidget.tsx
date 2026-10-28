"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Clock,
  Play,
  Pause,
  ArrowRight,
  Brain,
  Zap,
  Flame,
  CheckCircle2,
} from "lucide-react"
import { usePomodoro, type PomodoroPreset } from "@/hooks/usePomodoro"

interface QuickFocusWidgetProps {
  onOpenFocusTab: () => void
  onOpenAIMentor?: (prefill?: string) => void
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function QuickFocusWidget({
  onOpenFocusTab,
  onOpenAIMentor,
}: QuickFocusWidgetProps) {
  const {
    preset,
    description,
    status,
    timeLeft,
    progressPct,
    activeDurationMinutes,
    startedAt,
    pauseCount,
    pauseDescription,
    setPauseDescription,
    startTimer,
    resumeTimer,
    pauseTimer,
    finishEarly,
    setPreset,
    setDescription,
  } = usePomodoro()

  const isRunning = status === "running"
  const isPaused = status === "paused"

  const handleConsultAI = () => {
    if (onOpenAIMentor) {
      const task = description.trim() || `${activeDurationMinutes}m focus block`
      onOpenAIMentor(
        `I'm currently engaged in a focus session on: "${task}". What are 2 cognitive traps to avoid and 3 high-yield GATE concepts to test myself on right now?`,
      )
    }
  }

  return (
    <Card className="border-border/80 overflow-hidden bg-gradient-to-r from-card via-card to-background">
      <CardHeader className="py-3 px-4 sm:px-5 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Deep Work Pomodoro</CardTitle>
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-500 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Running
                </span>
              )}
              {isPaused && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-500 border border-amber-500/20">
                  Paused
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFocusTab}
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
        >
          <span>Full Chamber</span>
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {isRunning || isPaused ? (
          // Active running/paused state
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
                    {formatTime(timeLeft)}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {preset === "180" ? "3h" : `${activeDurationMinutes}m`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-sm">
                  {description.trim() ? (
                    <span>Task: &ldquo;{description}&rdquo;</span>
                  ) : (
                    <span>No task description specified</span>
                  )}
                </p>
                {startedAt && (
                  <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 pt-0.5">
                    <span>Started {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>•</span>
                    <span className={pauseCount >= 3 ? "text-amber-500 font-semibold" : ""}>
                      {pauseCount === 0 ? "0 pauses" : `${pauseCount} pause${pauseCount > 1 ? "s" : ""}`}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pauseTimer()}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    <span>Pause</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={resumeTimer}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Resume</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={finishEarly}
                  className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-500 border-emerald-500/30"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Claim EXP</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleConsultAI}
                  className="h-8 text-xs gap-1 text-primary hover:bg-primary/10"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>Ask AI</span>
                </Button>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* If Paused: Quick activity log for AI */}
            {isPaused && (
              <div className="flex items-center gap-2 pt-0.5 animate-in fade-in duration-200">
                <Input
                  value={pauseDescription}
                  onChange={(e) => setPauseDescription(e.target.value)}
                  placeholder="What are you doing during this pause? (Logged for AI mentor)"
                  className="h-7 text-xs bg-background/90 border-amber-500/30 text-foreground"
                />
              </div>
            )}
          </div>
        ) : (
          // Idle state - quick starter
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you focusing on? (e.g. Graph Theory PYQs)"
                  className="h-9 text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(["25", "90", "180"] as PomodoroPreset[]).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    onClick={() => setPreset(p)}
                    className="h-9 px-2.5 text-xs font-mono"
                  >
                    {p === "180" ? "3h" : `${p}m`}
                  </Button>
                ))}

                <Button
                  size="sm"
                  onClick={startTimer}
                  className="h-9 px-3 text-xs gap-1.5 font-medium ml-1"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Start Focus</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Brain className="h-3 w-3 text-primary" />
                AI Mentor automatically tracks this task description
              </span>
              <button
                type="button"
                onClick={onOpenFocusTab}
                className="text-primary hover:underline"
              >
                Custom minutes & presets →
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

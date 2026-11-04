"use client"

import { useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Brain,
  Zap,
  Flame,
  Clock,
  Sparkles,
  Coffee,
  Check,
  ChevronRight,
  SlidersHorizontal,
  History,
  BookOpen,
  PenLine,
  FileQuestion,
  Calendar,
  BarChart3,
  ListTodo,
  Link2,
  Unlink,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { usePomodoro, type PomodoroPreset, type FocusType } from "@/hooks/usePomodoro"
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition"
import { useUserData } from "@/hooks/useUserData"
import { useTodos, formatTime12h, getSlotStatus } from "@/hooks/useTodos"
import { TimetableTodoList } from "@/components/TimetableTodoList"
import { FocusTimelineAnalysis } from "@/components/FocusTimelineAnalysis"

interface PomodoroTimerProps {
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

const PRESET_OPTIONS: Array<{
  id: PomodoroPreset
  label: string
  subtitle: string
  minutes: number
  icon: typeof Zap
}> = [
  {
    id: "25",
    label: "25 min",
    subtitle: "Sprint / Recall",
    minutes: 25,
    icon: Zap,
  },
  {
    id: "90",
    label: "90 min",
    subtitle: "Deep Ultradian",
    minutes: 90,
    icon: Brain,
  },
  {
    id: "180",
    label: "3 Hours",
    subtitle: "GATE Mock Mode",
    minutes: 180,
    icon: Flame,
  },
  {
    id: "custom",
    label: "Custom",
    subtitle: "Configurable",
    minutes: 45,
    icon: SlidersHorizontal,
  },
]

export function PomodoroTimer({ onOpenAIMentor }: PomodoroTimerProps) {
  const {
    preset,
    customMinutes,
    description,
    focusType,
    mode,
    status,
    timeLeft,
    progressPct,
    activeDurationMinutes,
    history,
    todaySessions,
    todayFocusMinutes,
    todayExpEarned,
    startedAt,
    lastPausedAt,
    pauseCount,
    totalPausedSeconds,
    pauseDescription,
    setPauseDescription,
    startTimer,
    resumeTimer,
    pauseTimer,
    resetTimer,
    finishEarly,
    setPreset,
    setDescription,
    setFocusType,
    setBreakMode,
  } = usePomodoro()

  const [focusSectionTab, setFocusSectionTab] = useState<"timer" | "timetable" | "analytics">("timer")
  const { todos, activeTodo, assignTodoToTimer, unlinkActiveTodo } = useTodos()

  const liveTelemetryState = useMemo(() => ({
    status,
    mode,
    startedAt,
    lastPausedAt,
    activeDurationMinutes,
    timeLeft,
    pauseCount,
    totalPausedSeconds,
    description,
  }), [status, mode, startedAt, lastPausedAt, activeDurationMinutes, timeLeft, pauseCount, totalPausedSeconds, description])

  const uncompletedTodos = useMemo(() => todos.filter((t) => !t.completed), [todos])
  const scheduledSlotsCount = useMemo(() => todos.filter((t) => t.hasTimeSlot && !t.completed).length, [todos])

  const activeSlotTodo = useMemo(() => {
    return todos.find((t) => {
      if (t.completed || !t.hasTimeSlot || !t.startTime || !t.endTime) return false
      const evalStatus = getSlotStatus(t.startTime, t.endTime, t.scheduledDate)
      return evalStatus.isActive
    })
  }, [todos])

  const [customInput, setCustomInput] = useState<string>(String(customMinutes || 45))
  const [customOpen, setCustomOpen] = useState(false)
  const spacedRepetition = useSpacedRepetition()
  const { progress } = useUserData()
  const currentExp = progress.currentExp

  // Suggestions customized for each focus type
  const dueTopicNames = spacedRepetition.dueTopics.map((t) => t.name).slice(0, 4)
  const focusTypeSuggestions: Record<FocusType, string[]> = {
    lecture: [
      "Computer Networks Layer Architecture & TCP/IP Video",
      "OS Virtual Memory & Multi-level Paging Lecture",
      "Compiler Design LL(1) & LR Parsing Class",
      "Algorithms Asymptotic Notation & Recurrences",
    ],
    practice: [
      "Solving 20 GATE PYQs on Graph Theory & Dijkstra",
      "Operating Systems Deadlocks & Semaphores MCQs",
      "DBMS SQL Queries & Relational Algebra Practice",
      "Digital Logic K-Maps & Combinational Circuits",
    ],
    revision:
      dueTopicNames.length > 0
        ? dueTopicNames
        : [
            "Formula Flashcards & Active Recall",
            "OS CPU Scheduling Formulas & Turnaround Time",
            "Cache Memory Direct & Set Associative Mapping",
            "Computer Architecture Pipelining Hazards Formula",
          ],
    mock_test: [
      "GATE CS Full Paper Test 1 (Closed Book Simulation)",
      "Made Easy Subject Test - Operating Systems (50M)",
      "Testbook Subject Test - Computer Networks",
      "Topic-wise Timed Quiz - Data Structures",
    ],
    other: [
      "GATE 2026 Syllabus Weightage & Gap Analysis",
      "Weakness Diagnosis & Mistake Notebook Review",
      "Weekly Schedule & Strategy Calibration",
    ],
  }

  const quickTopics = focusTypeSuggestions[focusType] || focusTypeSuggestions.practice

  const handleCustomApply = () => {
    const val = parseInt(customInput, 10)
    if (!isNaN(val) && val >= 1 && val <= 360) {
      setPreset("custom", val)
      setCustomOpen(false)
    }
  }

  const handleConsultAI = () => {
    const taskContext = description.trim() || `${activeDurationMinutes}m focus session`
    const prefill = `I'm currently engaged in a ${activeDurationMinutes}-minute focus block on: "${taskContext}". Can you evaluate high-yield focus traps, core formulas, and 2 active recall diagnostic questions for this session?`
    if (onOpenAIMentor) {
      onOpenAIMentor(prefill)
    }
  }

  const isRunning = status === "running"
  const isPaused = status === "paused"
  const isCompleted = status === "completed"

  return (
    <div id="pomodoro-timer-section" className="space-y-6">
      {/* Focus Module Top Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <Tabs value={focusSectionTab} onValueChange={(val: any) => setFocusSectionTab(val)}>
          <TabsList className="h-9 bg-muted/60 p-1">
            <TabsTrigger value="timer" className="text-xs h-7 gap-1.5 px-3">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Focus Chamber</span>
              {isRunning && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="timetable" className="text-xs h-7 gap-1.5 px-3">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>Timetable & Tasks</span>
              {scheduledSlotsCount > 0 && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 ml-1">
                  {scheduledSlotsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs h-7 gap-1.5 px-3">
              <BarChart3 className="h-3.5 w-3.5 text-sky-500" />
              <span>24h & 7-Day Graph</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTodo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-[11px]">Active Task:</span>
            <Badge variant="outline" className="border-primary/40 text-primary font-normal truncate max-w-[200px]">
              {activeTodo.title}
            </Badge>
          </div>
        )}
      </div>

      {focusSectionTab === "timetable" && (
        <TimetableTodoList
          onAssignToTimer={() => setFocusSectionTab("timer")}
          onOpenTimer={() => setFocusSectionTab("timer")}
        />
      )}

      {focusSectionTab === "analytics" && (
        <FocusTimelineAnalysis sessions={history} liveState={liveTelemetryState} />
      )}

      {focusSectionTab === "timer" && (
        <>
          {/* Main Focus Console Card */}
          <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardHeader className="pb-3 border-b bg-card/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Focus Chamber</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 px-1.5 border-primary/30 text-primary">
                    {mode === "work" ? "Deep Study" : "Rest & Recharge"}
                  </Badge>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] text-primary font-mono tabular-nums">
                    <Flame className="h-3 w-3 text-amber-500" />
                    {currentExp.toLocaleString()} Total EXP
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Grounded in ultradian rhythms. Focus blocks credit directly to your main profile and daily report.
                </CardDescription>
              </div>
            </div>

            {/* Mode Toggle (Focus vs Break) */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setBreakMode(false)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  mode === "work"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Focus Block
              </button>
              <button
                type="button"
                onClick={() => setBreakMode(true)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  mode === "break"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Coffee className="inline h-3 w-3 mr-1" />
                Break
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          {/* Preset Selection Buttons (25m, 90m, 3h, Custom) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Select Duration Preset</span>
              <span className="text-[11px]">
                {preset === "25" && "25m Sprint (Standard Pomodoro)"}
                {preset === "90" && "90m Ultradian Deep Work Block"}
                {preset === "180" && "3-Hour Full Exam Simulation (180m)"}
                {preset === "custom" && `Custom ${customMinutes} Minutes`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = preset === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === "custom") {
                        setCustomOpen(true)
                      }
                      setPreset(opt.id)
                    }}
                    className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                        : "border-border/70 bg-card hover:border-primary/40 hover:bg-accent/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="mt-2.5">
                      <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{opt.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Custom Minutes Drawer/Popover if Custom is active */}
            {preset === "custom" && (
              <div className="flex items-center gap-2 mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">Custom minutes:</span>
                <Input
                  type="number"
                  min="1"
                  max="360"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="h-8 w-24 text-center font-mono text-sm bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCustomApply}
                  className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                >
                  Apply
                </Button>
                <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
                  Range: 1 to 360 min (6 hours max)
                </span>
              </div>
            )}
          </div>

          {/* Task Focus & Description Input — communicated directly to AI Mentor */}
          <div className="space-y-3 rounded-xl border border-border/80 bg-background/50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                Session Focus & Description
              </label>

              <div className="flex items-center gap-2">
                {uncompletedTodos.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <ListTodo className="h-3 w-3" />
                        <span>Assign from Tasks ({uncompletedTodos.length})</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel className="text-xs font-semibold">
                        Scheduled Timetable & Study Tasks
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {uncompletedTodos.slice(0, 8).map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => assignTodoToTimer(t.id)}
                          className="text-xs flex flex-col items-start gap-0.5 cursor-pointer p-2"
                        >
                          <span className="font-medium text-foreground truncate w-full">
                            {t.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {t.hasTimeSlot
                              ? `${formatTime12h(t.startTime)} – ${formatTime12h(t.endTime)}`
                              : `${t.durationMinutes}m`}{" "}
                            • <span className="capitalize">{t.focusType.replace("_", " ")}</span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <span className="text-[11px] text-primary hidden sm:flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Synced
                </span>
              </div>
            </div>

            {/* Active Todo Link Status Banner */}
            {activeTodo ? (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground text-[11px]">Linked Task:</span>
                  <span className="font-semibold text-primary truncate max-w-[240px] sm:max-w-md">
                    {activeTodo.title}
                  </span>
                  {activeTodo.hasTimeSlot && (
                    <Badge variant="outline" className="font-mono text-[10px] py-0 border-primary/30 text-primary">
                      {formatTime12h(activeTodo.startTime)} – {formatTime12h(activeTodo.endTime)}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={unlinkActiveTodo}
                  className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-1.5 ml-2"
                  title="Unlink from timer"
                >
                  <Unlink className="h-3 w-3 mr-1" />
                  Unlink
                </Button>
              </div>
            ) : activeSlotTodo ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-muted-foreground text-[11px]">Timetable Slot Active:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-sm">
                    {activeSlotTodo.title}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-500">
                    ({formatTime12h(activeSlotTodo.startTime)} – {formatTime12h(activeSlotTodo.endTime)})
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => assignTodoToTimer(activeSlotTodo.id)}
                  className="h-6 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 px-2 ml-2"
                >
                  <Play className="h-2.5 w-2.5 fill-current mr-1" />
                  Load Task
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-[175px_minmax(0,1fr)] gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Focus Activity</label>
                <Select value={focusType} onValueChange={(val: FocusType) => setFocusType(val)}>
                  <SelectTrigger className="h-10 text-xs bg-background">
                    <SelectValue placeholder="Select Focus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                        <span>Lecture</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="practice">
                      <div className="flex items-center gap-2">
                        <PenLine className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Practice</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="revision">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-purple-500" />
                        <span>Revision</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="mock_test">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="h-3.5 w-3.5 text-amber-500" />
                        <span>Mock Test</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="other">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Other</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="pomodoro-task-desc" className="text-[11px] font-medium text-muted-foreground">
                  Task / Topic Description
                </label>
                <Input
                  id="pomodoro-task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    focusType === "lecture"
                      ? "e.g., Computer Networks Lecture 6 - TCP Flow & Congestion Control..."
                      : focusType === "practice"
                        ? "e.g., Solving 25 GATE PYQs on Graph Theory & Dijkstra's Algorithm..."
                        : focusType === "revision"
                          ? "e.g., Revision of high-yield formulas and concepts..."
                          : focusType === "mock_test"
                            ? "e.g., GATE CS Full Mock Exam 1 (Closed Book Simulation)..."
                            : "e.g., Syllabus analysis and planning..."
                  }
                  className="h-10 text-sm bg-background border-border/80 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            {/* Topic Suggestion Chips */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground mr-1">Quick fill:</span>
              {quickTopics.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDescription(item)}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all truncate max-w-[280px]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Large Countdown Display */}
          <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card/80 to-background/90 py-10 px-4 text-center overflow-hidden">
            {/* Background Glow when running */}
            {isRunning && (
              <div className="absolute inset-0 bg-primary/5 blur-2xl pointer-events-none animate-pulse" />
            )}

            {/* Status Pill */}
            <div className="mb-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-medium ${
                  isRunning
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : isPaused
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : isCompleted
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground border border-border/50"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isRunning
                      ? "bg-emerald-500 animate-ping"
                      : isPaused
                        ? "bg-amber-500"
                        : isCompleted
                          ? "bg-primary"
                          : "bg-muted-foreground"
                  }`}
                />
                {isRunning
                  ? "SESSION RUNNING"
                  : isPaused
                    ? "TIMER PAUSED"
                    : isCompleted
                      ? "SESSION COMPLETE"
                      : "READY TO START"}
              </span>
            </div>

            {/* Time String */}
            <div className="relative text-6xl sm:text-7xl font-mono font-bold tracking-tight text-foreground select-none tabular-nums">
              {formatTime(timeLeft)}
            </div>

            {/* Active Task Subtitle */}
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md truncate font-medium">
              {description.trim() ? (
                <span>Focusing on: &ldquo;{description.trim()}&rdquo;</span>
              ) : (
                <span>{activeDurationMinutes} min session • No description set</span>
              )}
            </p>

            {/* Live Session Telemetry (Start time, Pauses tracking) */}
            {(isRunning || isPaused) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-[11px] text-muted-foreground font-mono">
                {startedAt && (
                  <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                    <Clock className="h-3 w-3 text-primary" />
                    Started at {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                  <Pause className="h-3 w-3 text-amber-500" />
                  Pauses: {pauseCount} {totalPausedSeconds > 0 ? `(${Math.round(totalPausedSeconds / 60)}m paused)` : ""}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-sans">
                  <Sparkles className="h-3 w-3" />
                  Tracked by AI
                </span>
              </div>
            )}

            {/* Visual Progress Bar */}
            <div className="mt-6 w-full max-w-md h-2 rounded-full bg-muted/60 overflow-hidden border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Pause Description / Activity Input Card (Active when Paused) */}
            {isPaused && (
              <div className="w-full max-w-md mt-5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-left space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <label htmlFor="pomodoro-pause-reason" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5 text-amber-500" />
                    <span>What did you do during this pause?</span>
                  </label>
                  <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Tracking Active
                  </span>
                </div>

                <Input
                  id="pomodoro-pause-reason"
                  value={pauseDescription}
                  onChange={(e) => setPauseDescription(e.target.value)}
                  placeholder="e.g. Drank water & stretched, quick phone check, restroom break, snack..."
                  className="h-9 text-xs bg-background/90 border-amber-500/30 focus-visible:ring-amber-500/40"
                />

                {/* Quick Pause Activity Tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-[10px] text-muted-foreground">Quick tag:</span>
                  {[
                    "💧 Water & Hydration",
                    "🚶 Walk / Stretch",
                    "🚽 Restroom Break",
                    "☕ Coffee / Tea",
                    "🍎 Snack / Meal",
                    "📱 Phone / Messages",
                    "👀 Eye Rest & Breathe",
                    "❓ Checked Doubt / Formula",
                  ].map((chip) => (
                    <Badge
                      key={chip}
                      variant={pauseDescription === chip ? "default" : "outline"}
                      className="cursor-pointer text-[10px] py-0 px-2 h-5 font-normal transition-colors"
                      onClick={() => setPauseDescription(chip)}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Your AI Mentor reads this pause log to diagnose distraction triggers vs healthy recovery breaks.
                </p>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {!isRunning && !isPaused && (
                <Button
                  size="lg"
                  onClick={startTimer}
                  className="h-11 px-7 text-sm font-semibold gap-2 shadow-md hover:scale-[1.02] transition-transform"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Focus Session</span>
                </Button>
              )}

              {isRunning && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => pauseTimer()}
                    className="h-11 px-6 text-sm font-semibold gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    <span>Pause</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="default"
                    onClick={finishEarly}
                    className="h-11 px-6 text-sm font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Complete & Claim EXP</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={resetTimer}
                    className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              )}

              {isPaused && (
                <>
                  <Button
                    size="lg"
                    onClick={() => {
                      resumeTimer()
                      if (pauseDescription.trim()) {
                        toast.success("Focus Resumed", {
                          description: `Pause activity logged for AI: "${pauseDescription.trim()}"`,
                        })
                      }
                    }}
                    className="h-11 px-7 text-sm font-semibold gap-2 shadow-md hover:scale-[1.02] transition-transform"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Resume Focus</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={resetTimer}
                    className="h-11 px-4 text-xs gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={finishEarly}
                    className="h-11 px-4 text-xs gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Finish Early</span>
                  </Button>
                </>
              )}

              {isCompleted && (
                <>
                  <Button
                    size="lg"
                    onClick={() => {
                      resetTimer()
                      startTimer()
                    }}
                    className="h-11 px-6 text-sm font-semibold gap-2"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Start Another Session</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setBreakMode(true)}
                    className="h-11 px-6 text-sm font-semibold gap-2"
                  >
                    <Coffee className="h-4 w-4" />
                    <span>Take Break</span>
                  </Button>
                </>
              )}
            </div>

            {/* Quick Action: Ask AI Mentor about this active session */}
            <div className="mt-6 border-t border-border/40 pt-4 w-full max-w-md flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Need guidance or practice questions?
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleConsultAI}
                className="h-7 text-xs text-primary hover:bg-primary/10 gap-1.5 px-2.5"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Consult AI Mentor</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Daily Analytics Summary (Focus time, Completed count, EXP earned) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card/60 p-3 sm:p-4 text-center">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Focus Time Today
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold font-mono text-foreground tabular-nums">
                {todayFocusMinutes}
                <span className="ml-1 text-xs font-normal text-muted-foreground">min</span>
              </p>
            </div>

            <div className="rounded-xl border bg-card/60 p-3 sm:p-4 text-center">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Sessions Done
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold font-mono text-foreground tabular-nums">
                {todaySessions.length}
                <span className="ml-1 text-xs font-normal text-muted-foreground">blocks</span>
              </p>
            </div>

            <div className="rounded-xl border bg-card/60 p-3 sm:p-4 text-center">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Focus EXP Today
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-bold font-mono text-primary tabular-nums">
                +{todayExpEarned}
                <span className="ml-1 text-xs font-normal text-muted-foreground">EXP</span>
              </p>
              <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
                ✓ Synced to Main Rank
              </p>
            </div>
          </div>

          {/* Completed Sessions History Log for Today */}
          {todaySessions.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  Today&apos;s Completed Focus Blocks
                </p>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="space-y-2 divide-y divide-border/40">
                {todaySessions.map((s) => (
                  <div key={s.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{s.description || "Deep focus session"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.durationMinutes} min ({s.preset === "180" ? "3 Hours" : `${s.preset}m`})
                        {s.startedAt && ` • Started: ${new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        {" • "}Finished: {new Date(s.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.pauseCount !== undefined && (
                          <span className="ml-1 text-muted-foreground">
                            • {s.pauseCount === 0 ? "0 pauses (pure flow)" : `${s.pauseCount} pause${s.pauseCount > 1 ? "s" : ""}${s.totalPausedSeconds ? ` (${Math.round(s.totalPausedSeconds / 60)}m)` : ""}`}
                            {s.lastPauseDescription && (
                              <span className="text-amber-500 font-normal"> · &ldquo;{s.lastPauseDescription}&rdquo;</span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[11px] text-primary">
                      +{s.expAwarded} EXP
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 24-Hour & 7-Day Timeline Graph */}
      <FocusTimelineAnalysis sessions={history} liveState={liveTelemetryState} />
    </>
  )}
</div>
  )
}

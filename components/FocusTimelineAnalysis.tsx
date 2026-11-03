"use client"

import { useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"
import {
  Clock,
  Pause,
  Coffee,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Sparkles,
  TrendingUp,
  Calendar,
  Layers,
  ChevronRight,
  BookOpen,
  PenLine,
  RotateCcw,
  FileQuestion,
  Info,
  Zap,
} from "lucide-react"
import {
  getChronologicalSessionsForDay,
  compute7DayPatternMatrix,
  computeWeeklyTimeWiseAverage,
  type ChronologicalSessionBlock,
  type ActiveSessionLiveState,
} from "@/lib/focus-timeline"
import type { PomodoroSessionRecord } from "@/hooks/usePomodoro"
import { formatHourLabel } from "@/lib/study-pattern"
import { subDays } from "date-fns"

export interface FocusTimelineAnalysisProps {
  sessions: PomodoroSessionRecord[]
  liveState?: ActiveSessionLiveState
  className?: string
}

export function FocusTimelineAnalysis({
  sessions,
  liveState,
  className = "",
}: FocusTimelineAnalysisProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "weekly_matrix" | "average_curve">("timeline")
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0) // 0 = Today, 1 = Yesterday...

  const targetDate = useMemo(() => subDays(new Date(), selectedDayOffset), [selectedDayOffset])

  // 1. Chronological Day Sessions (When timer was running, paused, on break)
  const daySessions = useMemo(() => {
    return getChronologicalSessionsForDay(
      sessions,
      targetDate,
      selectedDayOffset === 0 ? liveState : undefined,
    )
  }, [sessions, targetDate, selectedDayOffset, liveState])

  // 2. 7-Day Pattern Matrix (Day of Week vs Time Windows Heatmap)
  const patternMatrix = useMemo(() => {
    return compute7DayPatternMatrix(sessions, liveState)
  }, [sessions, liveState])

  // 3. 24-Hour Weekly Average Curve Data
  const weeklyAverageData = useMemo(() => {
    return computeWeeklyTimeWiseAverage(sessions, liveState).map((item) => ({
      hour: item.hour,
      label: item.label,
      window: item.windowLabel,
      avgFocus: item.avgFocusMinutes,
      avgPause: item.avgPauseMinutes,
      avgBreak: item.avgBreakMinutes,
      consistency: item.consistencyScore,
      isPeakFocus: item.isPeakFocusHour,
      isPeakPause: item.isPeakPauseHour,
    }))
  }, [sessions, liveState])

  // Day Totals
  const dayTotals = useMemo(() => {
    let focus = 0
    let pause = 0
    let breaks = 0
    let totalPausesCount = 0

    daySessions.forEach((s) => {
      if (s.isBreak) {
        breaks += s.durationMinutes
      } else {
        focus += s.netFocusMinutes
        pause += s.pausedMinutes
        totalPausesCount += s.pauseCount
      }
    })

    const totalActive = focus + pause + breaks
    const stamina = focus + pause > 0 ? Math.round((focus / (focus + pause)) * 100) : 100

    return { focus, pause, breaks, totalPausesCount, totalActive, stamina }
  }, [daySessions])

  // Current time minute for vertical cursor indicator on timeline
  const now = new Date()
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes()

  return (
    <Card className={`border-border shadow-sm overflow-hidden ${className}`}>
      {/* Header with 3 Core Pattern Analysis Tabs */}
      <CardHeader className="pb-3 border-b bg-card/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Clock className="h-4 w-4" />
              </span>
              <CardTitle className="text-base font-semibold">
                Study Pattern & Focus Telemetry Analyzer
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-emerald-500/30 text-emerald-500">
                24-Hour & 7-Day Matrix
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Understand exactly when you enter deep focus, when pauses and fatigue strike, and how your 7-day circadian patterns unfold.
            </CardDescription>
          </div>

          {/* Primary View Switcher */}
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="h-8 bg-muted/60 p-0.5">
              <TabsTrigger value="timeline" className="text-xs h-7 gap-1.5 px-2.5">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                <span>24h Day Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="weekly_matrix" className="text-xs h-7 gap-1.5 px-2.5">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>7-Day Pattern Grid</span>
              </TabsTrigger>
              <TabsTrigger value="average_curve" className="text-xs h-7 gap-1.5 px-2.5">
                <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
                <span>Weekly Time-Wise Avg</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Diagnostic KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
          {/* Total Focus */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {activeTab === "timeline" ? "Focus Time" : "Daily Avg Focus"}
            </p>
            <p className="mt-1 text-lg font-bold font-mono text-foreground tabular-nums">
              {activeTab === "timeline" ? (
                <>
                  {Math.floor(dayTotals.focus / 60)}h {dayTotals.focus % 60}m
                </>
              ) : (
                <>
                  {Math.floor(patternMatrix.avgDailyFocusMinutes / 60)}h{" "}
                  {patternMatrix.avgDailyFocusMinutes % 60}m
                </>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeTab === "timeline"
                ? `${daySessions.filter((s) => !s.isBreak).length} focus blocks`
                : "7-day daily mean"}
            </p>
          </div>

          {/* Pauses Taken */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Pause className="h-3 w-3 text-amber-500" />
              {activeTab === "timeline" ? "Time in Pauses" : "Daily Avg Pauses"}
            </p>
            <p className="mt-1 text-lg font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {activeTab === "timeline"
                ? `${dayTotals.pause}m`
                : `${patternMatrix.avgDailyPauseMinutes}m`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeTab === "timeline"
                ? `${dayTotals.totalPausesCount} pause events`
                : "Lost to pauses / day"}
            </p>
          </div>

          {/* Breaks Taken */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-2.5">
            <p className="text-[10px] font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Coffee className="h-3 w-3 text-sky-500" />
              {activeTab === "timeline" ? "Breaks Taken" : "Daily Avg Breaks"}
            </p>
            <p className="mt-1 text-lg font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
              {activeTab === "timeline"
                ? `${dayTotals.breaks}m`
                : `${patternMatrix.avgDailyBreakMinutes}m`}
            </p>
            <p className="text-[10px] text-muted-foreground">Rest & recharge blocks</p>
          </div>

          {/* Flow Stamina */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <p className="text-[10px] font-medium text-primary flex items-center gap-1">
              <Flame className="h-3 w-3 text-primary" />
              Focus Stamina Rate
            </p>
            <p className="mt-1 text-lg font-bold font-mono text-primary tabular-nums">
              {activeTab === "timeline"
                ? `${dayTotals.stamina}%`
                : `${patternMatrix.overallStamina}%`}
            </p>
            <p className="text-[10px] text-muted-foreground">Focus vs pause purity</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: 24-HOUR CHRONOLOGICAL DAY TIMELINE (GANTT SWIMLANE VIEW)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "timeline" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Day Selector Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] text-muted-foreground mr-1">Select Day:</span>
                {[
                  { offset: 0, label: "Today (Live)" },
                  { offset: 1, label: "Yesterday" },
                  { offset: 2, label: "2 Days Ago" },
                  { offset: 3, label: "3 Days Ago" },
                  { offset: 4, label: "4 Days Ago" },
                ].map((d) => (
                  <button
                    key={d.offset}
                    type="button"
                    onClick={() => setSelectedDayOffset(d.offset)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedDayOffset === d.offset
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-muted-foreground">
                {targetDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
              </div>
            </div>

            {/* Visual 24-Hour Horizontal Swimlane Scale (00:00 to 24:00) */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3 sm:p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Chronological 24-Hour Day Timeline (00:00 – 24:00)
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Focus Running
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-500" /> Pauses Taken
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-sky-500" /> Break Mode
                  </span>
                </div>
              </div>

              {/* The Timeline Track Container */}
              <div className="relative h-12 w-full rounded-lg bg-muted/40 border border-border/50 overflow-hidden">
                {/* 4-hour background grid lines */}
                {[0, 240, 480, 720, 960, 1200].map((mins) => (
                  <div
                    key={mins}
                    className="absolute top-0 bottom-0 border-r border-border/30 pointer-events-none"
                    style={{ left: `${(mins / 1440) * 100}%` }}
                  />
                ))}

                {/* Session Blocks positioned accurately across the 24 hours */}
                {daySessions.map((session) => {
                  const leftPct = (session.startMinutesOfDay / 1440) * 100
                  const widthPct = Math.max(1.5, (session.durationMinutes / 1440) * 100)

                  return (
                    <TooltipProvider key={session.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all hover:scale-y-110 hover:z-20 border shadow-sm ${
                              session.isBreak
                                ? "bg-sky-500/80 border-sky-400"
                                : "bg-emerald-500/90 border-emerald-400 hover:bg-emerald-500"
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          >
                            {/* Inner pause markings if pauses occurred */}
                            {session.pausedMinutes > 0 && (
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-amber-500 border-l border-amber-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (session.pausedMinutes / session.durationMinutes) * 100,
                                  )}%`,
                                }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs p-2 max-w-xs">
                          <p className="font-semibold">{session.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {session.startTimeFormatted} – {session.endTimeFormatted} ({session.durationMinutes}m)
                          </p>
                          <p className="text-[11px] pt-1 text-emerald-400">
                            Focus: {session.netFocusMinutes}m • Pauses: {session.pausedMinutes}m
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}

                {/* Vertical Live "Current Time" Cursor */}
                {selectedDayOffset === 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none"
                    style={{ left: `${(currentMinutesOfDay / 1440) * 100}%` }}
                  >
                    <span className="absolute -top-1 -translate-x-1/2 h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}
              </div>

              {/* Time axis labels */}
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground pt-0.5 px-0.5">
                <span>12 AM</span>
                <span>4 AM</span>
                <span>8 AM</span>
                <span>12 PM</span>
                <span>4 PM</span>
                <span>8 PM</span>
                <span>12 AM</span>
              </div>
            </div>

            {/* Detailed Chronological Session Breakdown Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Logged Sessions & Activity Intervals ({daySessions.length})
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Exact start, pause, and break breakdown
                </span>
              </div>

              {daySessions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto stroke-1" />
                  <p className="text-xs font-medium text-foreground">
                    No focus sessions logged on this day.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Start the timer to record your focus, pause, and break telemetry.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {daySessions.map((s) => (
                    <div
                      key={s.id}
                      className={`rounded-xl border p-3.5 transition-all ${
                        s.isBreak
                          ? "border-sky-500/30 bg-sky-500/[0.03]"
                          : "border-border/80 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Time Window Pill */}
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 border border-border/50 text-foreground">
                              {s.startTimeFormatted} – {s.endTimeFormatted}
                            </span>

                            {/* Activity Type Badge */}
                            <Badge
                              variant="secondary"
                              className={`text-[10px] py-0 h-4 gap-1 ${
                                s.isBreak
                                  ? "bg-sky-500/10 text-sky-500 border-sky-500/20"
                                  : "text-primary"
                              }`}
                            >
                              {s.focusType === "lecture" && <BookOpen className="h-2.5 w-2.5 text-blue-500" />}
                              {s.focusType === "practice" && <PenLine className="h-2.5 w-2.5 text-emerald-500" />}
                              {s.focusType === "revision" && <RotateCcw className="h-2.5 w-2.5 text-purple-500" />}
                              {s.focusType === "mock_test" && <FileQuestion className="h-2.5 w-2.5 text-amber-500" />}
                              {s.isBreak && <Coffee className="h-2.5 w-2.5 text-sky-500" />}
                              <span className="capitalize">{s.focusType.replace("_", " ")}</span>
                            </Badge>

                            {/* Net Stamina Badge */}
                            {!s.isBreak && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 h-4 font-mono ${
                                  s.staminaPct >= 90
                                    ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                    : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                                }`}
                              >
                                {s.staminaPct}% Flow
                              </Badge>
                            )}
                          </div>

                          {/* Title */}
                          <p className="text-sm font-semibold text-foreground tracking-tight">
                            {s.title}
                          </p>
                        </div>

                        {/* Right: Exact Minute Durations */}
                        <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                          {!s.isBreak ? (
                            <>
                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block font-sans">
                                  Running Focus
                                </span>
                                <span className="font-bold text-emerald-500 text-sm">
                                  {s.netFocusMinutes}m
                                </span>
                              </div>
                              <div className="text-right border-l pl-3">
                                <span className="text-[10px] text-muted-foreground block font-sans">
                                  Pauses ({s.pauseCount})
                                </span>
                                <span
                                  className={`font-bold text-sm ${
                                    s.pausedMinutes > 0 ? "text-amber-500" : "text-muted-foreground"
                                  }`}
                                >
                                  {s.pausedMinutes}m
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground block font-sans">
                                Rest Duration
                              </span>
                              <span className="font-bold text-sky-500 text-sm">
                                {s.durationMinutes}m
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual segmented duration progress bar */}
                      <div className="mt-3 w-full h-1.5 rounded-full bg-muted/60 overflow-hidden flex">
                        {!s.isBreak ? (
                          <>
                            <div
                              className="bg-emerald-500 h-full transition-all"
                              style={{ width: `${s.staminaPct}%` }}
                              title={`Focus: ${s.netFocusMinutes}m`}
                            />
                            {s.pausedMinutes > 0 && (
                              <div
                                className="bg-amber-500 h-full transition-all"
                                style={{ width: `${100 - s.staminaPct}%` }}
                                title={`Paused: ${s.pausedMinutes}m`}
                              />
                            )}
                          </>
                        ) : (
                          <div className="bg-sky-500 h-full w-full" />
                        )}
                      </div>

                      {/* Pauses List Details */}
                      {s.pauses.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/40 space-y-1">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                            <Pause className="h-2.5 w-2.5 text-amber-500" />
                            Logged Pauses during this block:
                          </p>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {s.pauses.map((p, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[11px]"
                              >
                                <strong>{p.durationMinutes}m</strong> at {p.timeFormatted} • &ldquo;{p.description}&rdquo;
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: 7-DAY WEEKLY PATTERN MATRIX (HEATMAP VIEW)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "weekly_matrix" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>7-Day Time Window Pattern Matrix</span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Quickly spot which times of day you consistently crush versus where fatigue and distraction recur.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Deep Focus Block
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Pause Distraction
                </span>
              </div>
            </div>

            {/* Matrix Grid Table */}
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-background/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Day</th>
                    <th className="py-2.5 px-3 font-semibold">Early Morning<br /><span className="text-[10px] font-normal text-muted-foreground">04:00 – 08:00</span></th>
                    <th className="py-2.5 px-3 font-semibold">Morning<br /><span className="text-[10px] font-normal text-muted-foreground">08:00 – 12:00</span></th>
                    <th className="py-2.5 px-3 font-semibold">Afternoon<br /><span className="text-[10px] font-normal text-muted-foreground">12:00 – 16:00</span></th>
                    <th className="py-2.5 px-3 font-semibold">Evening<br /><span className="text-[10px] font-normal text-muted-foreground">16:00 – 20:00</span></th>
                    <th className="py-2.5 px-3 font-semibold">Night<br /><span className="text-[10px] font-normal text-muted-foreground">20:00 – 04:00</span></th>
                    <th className="py-2.5 px-3 font-semibold text-right">Daily Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                  {patternMatrix.rows.map((row) => (
                    <tr
                      key={row.dateLabel}
                      className={`hover:bg-muted/30 transition-colors ${
                        row.isToday ? "bg-primary/[0.03] font-semibold" : ""
                      }`}
                    >
                      {/* Day Label */}
                      <td className="py-3 px-3 font-sans text-foreground">
                        <div className="flex items-center gap-1.5">
                          {row.isToday && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          <span>{row.dayName}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({row.dateLabel})
                          </span>
                        </div>
                      </td>

                      {/* 5 Circadian Windows */}
                      {(
                        [
                          row.windows.earlyMorning,
                          row.windows.morning,
                          row.windows.afternoon,
                          row.windows.evening,
                          row.windows.night,
                        ] as const
                      ).map((win, idx) => {
                        const hasFocus = win.focus > 0
                        const hasPause = win.pauses > 0
                        const hasBreak = win.breaks > 0

                        if (!hasFocus && !hasBreak) {
                          return (
                            <td key={idx} className="py-3 px-3 text-muted-foreground/40 font-sans">
                              —
                            </td>
                          )
                        }

                        return (
                          <td key={idx} className="py-3 px-3">
                            <div className="space-y-0.5">
                              {hasFocus && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 font-bold">
                                  {Math.floor(win.focus / 60)}h {win.focus % 60}m
                                </span>
                              )}
                              {hasPause && (
                                <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                                  ⚠️ {win.pauses}m paused
                                </span>
                              )}
                              {hasBreak && !hasFocus && (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 px-1.5 py-0.5">
                                  ☕ {win.breaks}m break
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}

                      {/* Daily Total */}
                      <td className="py-3 px-3 text-right">
                        <span className="text-foreground font-bold">
                          {Math.floor(row.totalFocusMinutes / 60)}h {row.totalFocusMinutes % 60}m
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {row.staminaScore}% Flow
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pattern Diagnosis Callout Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Your Golden Circadian Flow Window: {patternMatrix.peakFocusWindow}</span>
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your concentration is highest during <strong className="text-foreground">{patternMatrix.peakFocusWindow}</strong> with near-zero distractions. Protect this sacred deep-work block for heavy GATE subjects (Algorithms, Computer Networks, OS).
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Primary Fatigue Trap Detected: {patternMatrix.peakLagWindow}</span>
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pauses and interruptions disproportionately cluster during <strong className="text-foreground">{patternMatrix.peakLagWindow}</strong> (averaging {patternMatrix.avgDailyPauseMinutes}m lost).
                  Schedule an active 15m recharge break before this window to stay alert.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: TIME-WISE WEEKLY AVERAGE CURVE (HOURLY DISTRIBUTION AREA CHART)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "average_curve" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>Weekly Time-Wise Hourly Average Curve</span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Mean minutes spent in running focus, pauses, and breaks for every hour of the 24-hr day over the past 7 days.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Avg Focus
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Avg Pauses
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Avg Breaks
                </span>
              </div>
            </div>

            {/* Smooth Recharts Area Curve */}
            <div className="w-full h-[290px] rounded-xl border border-border/80 bg-background/50 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weeklyAverageData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="pauseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="breakGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    fontSize={10}
                    interval={1}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    fontSize={10}
                    domain={[0, 60]}
                    ticks={[0, 15, 30, 45, 60]}
                  />
                  <RechartsTooltip content={<CustomAverageTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="avgFocus"
                    name="Avg Focus"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#focusGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgPause"
                    name="Avg Pauses"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#pauseGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgBreak"
                    name="Avg Breaks"
                    stroke="#0EA5E9"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#breakGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Hour-by-Hour Diagnostic Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
              <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Prime Study Hour</span>
                <p className="font-bold font-mono text-emerald-500 text-sm">04:00 – 07:00</p>
                <p className="text-[11px] text-muted-foreground">Avg 52 min focus / hour</p>
              </div>

              <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Highest Consistency</span>
                <p className="font-bold font-mono text-foreground text-sm">7 of 7 Days Active</p>
                <p className="text-[11px] text-muted-foreground">100% early morning habit</p>
              </div>

              <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Peak Interruption</span>
                <p className="font-bold font-mono text-amber-500 text-sm">14:00 – 15:30</p>
                <p className="text-[11px] text-muted-foreground">Avg 14 min pause / hr</p>
              </div>

              <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Weekly Purity Score</span>
                <p className="font-bold font-mono text-primary text-sm">{patternMatrix.overallStamina}% Focus</p>
                <p className="text-[11px] text-muted-foreground">Stamina index</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CustomAverageTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[190px]">
      <div className="border-b pb-1 font-mono">
        <p className="font-semibold text-foreground">{d.window}</p>
        <p className="text-[10px] text-muted-foreground">7-Day Hourly Mean</p>
      </div>
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between text-emerald-500">
          <span>Avg Running Focus:</span>
          <span className="font-bold">{d.avgFocus}m</span>
        </div>
        <div className="flex items-center justify-between text-amber-500">
          <span>Avg Timer Pauses:</span>
          <span className="font-bold">{d.avgPause}m</span>
        </div>
        <div className="flex items-center justify-between text-sky-500">
          <span>Avg Breaks:</span>
          <span className="font-bold">{d.avgBreak}m</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground border-t pt-1 font-sans">
          <span>Habit Consistency:</span>
          <span className="font-mono text-foreground font-semibold">{d.consistency}% of days</span>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import {
  Clock,
  AlertTriangle,
  Sparkles,
  Sun,
  SunMedium,
  Sunset,
  Moon,
  Timer,
  ArrowRight,
  ShieldAlert,
  Volume2,
  Brain,
  Coffee,
  CheckCircle2,
  TrendingDown,
  Layers,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  StudyPatternAnalysis,
  TimeWindowKey,
  PauseTimeWindowBreakdown,
  HourlyPauseBreakdown,
} from "@/lib/study-pattern"

export interface PauseTimeAnalysisProps {
  analysis?: StudyPatternAnalysis
  onNavigateTab?: (tab: string) => void
  className?: string
}

const WINDOW_COLORS: Record<TimeWindowKey, { base: string; highlight: string; label: string }> = {
  morning: { base: "#F59E0B", highlight: "#D97706", label: "Morning" },
  afternoon: { base: "#3B82F6", highlight: "#2563EB", label: "Afternoon" },
  evening: { base: "#8B5CF6", highlight: "#7C3AED", label: "Evening" },
  night: { base: "#6366F1", highlight: "#4F46E5", label: "Late Night" },
}

const PEAK_LAG_COLOR = "#EF4444" // Crimson red/rose for the peak lagging window

export function PauseTimeAnalysis({
  analysis,
  onNavigateTab,
  className = "",
}: PauseTimeAnalysisProps) {
  const [viewMode, setViewMode] = useState<"windows" | "hourly">("windows")
  const [metric, setMetric] = useState<"pauses" | "minutes">("pauses")

  const pausePatterns = analysis?.pausePatterns
  const totalPauses = pausePatterns?.totalPauses ?? 0
  const totalPausedMinutes = pausePatterns?.totalPausedMinutes ?? 0
  const peakLag = pausePatterns?.peakLagWindow

  // Window data array formatted for Recharts
  const windowChartData = useMemo(() => {
    if (!pausePatterns?.timeBreakdown) {
      return [
        { window: "morning", name: "Morning", hours: "05:00 - 11:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0, fill: WINDOW_COLORS.morning.base },
        { window: "afternoon", name: "Afternoon", hours: "12:00 - 16:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0, fill: WINDOW_COLORS.afternoon.base },
        { window: "evening", name: "Evening", hours: "17:00 - 20:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0, fill: WINDOW_COLORS.evening.base },
        { window: "night", name: "Late Night", hours: "21:00 - 04:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0, fill: WINDOW_COLORS.night.base },
      ]
    }

    const tb = pausePatterns.timeBreakdown
    const keys: TimeWindowKey[] = ["morning", "afternoon", "evening", "night"]

    return keys.map((key) => {
      const d: PauseTimeWindowBreakdown = tb[key]
      const isPeak = d.isPeakLag && totalPauses > 0
      return {
        window: key,
        name: d.label,
        hours: d.hours,
        pauses: d.pauses,
        minutes: d.totalPausedMinutes,
        isPeakLag: isPeak,
        sessions: d.sessionCount,
        avgPauses: d.avgPausesPerSession,
        pct: d.percentageOfTotalPauses,
        fill: isPeak ? PEAK_LAG_COLOR : WINDOW_COLORS[key].base,
      }
    })
  }, [pausePatterns, totalPauses])

  // Hourly data array formatted for Recharts
  const hourlyChartData = useMemo(() => {
    if (!pausePatterns?.hourlyBreakdown) return []
    return pausePatterns.hourlyBreakdown.map((h: HourlyPauseBreakdown) => {
      const isWindowPeak = peakLag && peakLag.window !== "none" && h.window === peakLag.window && h.pauses > 0
      return {
        hour: h.hour,
        label: h.label,
        window: h.window,
        pauses: h.pauses,
        minutes: h.totalPausedMinutes,
        isPeakLag: isWindowPeak,
        fill: isWindowPeak ? PEAK_LAG_COLOR : WINDOW_COLORS[h.window].base,
      }
    })
  }, [pausePatterns, peakLag])

  const currentChartData = viewMode === "windows" ? windowChartData : hourlyChartData

  return (
    <Card className={`border-border bg-card shadow-sm ${className}`}>
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Pause Distribution & Lagging Time Diagnostic
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Telemetry of when pauses happen to reveal external disturbances vs distracted fatigue slumps
            </CardDescription>
          </div>

          {/* Peak Lag Window Badge */}
          <div className="flex items-center gap-2">
            {totalPauses > 0 && peakLag && peakLag.window !== "none" ? (
              <Badge
                variant="outline"
                className="font-mono text-xs border-amber-500/50 text-amber-500 bg-amber-500/10 flex items-center gap-1.5 py-1 px-2.5"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>
                  Peak Lag: <strong className="font-semibold text-foreground">{peakLag.label}</strong> ({peakLag.percentageOfTotalPauses}% of pauses)
                </span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="font-mono text-xs border-emerald-500/50 text-emerald-500 bg-emerald-500/10 flex items-center gap-1.5 py-1 px-2.5"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Zero Interruption Flow</span>
              </Badge>
            )}
          </div>
        </div>

        {/* View & Metric Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/20 text-xs">
            <button
              onClick={() => setViewMode("windows")}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === "windows"
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Time Windows (4 Blocks)
            </button>
            <button
              onClick={() => setViewMode("hourly")}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === "hourly"
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              24-Hour Timeline
            </button>
          </div>

          {/* Metric Toggle */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/20 text-xs">
            <button
              onClick={() => setMetric("pauses")}
              className={`px-2.5 py-1 rounded transition-colors ${
                metric === "pauses"
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pause Count
            </button>
            <button
              onClick={() => setMetric("minutes")}
              className={`px-2.5 py-1 rounded transition-colors ${
                metric === "minutes"
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Minutes Lost
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* ── Main Bar Chart ── */}
        <div className="w-full">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentChartData}
                margin={{ left: -15, right: 10, top: 10, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
                <XAxis
                  dataKey={viewMode === "windows" ? "name" : "label"}
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  interval={viewMode === "windows" ? 0 : 2}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-3 shadow-md text-xs space-y-1.5 min-w-[190px]">
                        <div className="flex items-center justify-between border-b pb-1">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            {data.name || data.label}
                            {data.hours && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({data.hours})
                              </span>
                            )}
                          </p>
                          {data.isPeakLag && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                              Lag Peak
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Pauses Taken:</span>
                          <span className="font-mono font-bold text-foreground">
                            {data.pauses} {data.pct !== undefined ? `(${data.pct}%)` : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Time Lost:</span>
                          <span className="font-mono font-bold text-amber-500">
                            {data.minutes}m
                          </span>
                        </div>
                        {data.sessions !== undefined && data.sessions > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground pt-1 border-t text-[11px]">
                            <span>Avg per block:</span>
                            <span className="font-mono font-medium text-foreground">
                              {data.avgPauses} pauses/sess
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey={metric}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={viewMode === "windows" ? 64 : 18}
                >
                  {currentChartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#EF4444]" />
              Red / Coral = Identified Peak Lag Window
            </span>
            <span>
              Total Lost to Pauses: <strong className="text-foreground font-mono">{totalPausedMinutes}m</strong> across {totalPauses} pauses
            </span>
          </div>
        </div>

        {/* ── 4 Circadian Window Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {windowChartData.map((item) => {
            const isLag = item.isPeakLag
            const icon =
              item.window === "morning" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : item.window === "afternoon" ? (
                <SunMedium className="h-4 w-4 text-blue-500" />
              ) : item.window === "evening" ? (
                <Sunset className="h-4 w-4 text-purple-500" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )

            return (
              <div
                key={item.window}
                className={`rounded-lg border p-3 transition-all ${
                  isLag
                    ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                    : "border-border/60 bg-muted/10 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    {icon}
                    {item.name}
                  </span>
                  {isLag && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded">
                      Lagging
                    </span>
                  )}
                  {!isLag && item.pauses === 0 && (
                    <span className="text-[9px] font-medium text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded">
                      Flow
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.hours}</p>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {item.pauses}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-1">pauses</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-amber-500">
                    {item.minutes}m lost
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
                  <span>{item.sessions} session{item.sessions !== 1 ? "s" : ""}</span>
                  <span>{item.pct}% share</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Diagnostic & Root Cause Deep Dive ── */}
        {peakLag && peakLag.window !== "none" && totalPauses > 0 ? (
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 sm:p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-border/60 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-amber-500/15 text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Lag Detected in the {peakLag.label} Window ({peakLag.timeRange})
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {peakLag.rootCauseAnalysis}
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground">Interruption Weight:</span>
                <span className="text-sm font-bold font-mono text-amber-500">
                  {peakLag.pauseCount} pauses ({peakLag.totalPausedMinutes}m lost)
                </span>
              </div>
            </div>

            {/* External Disturbance vs Distracted State Analysis */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Factor 1: External Disturbance */}
              <div className="rounded-lg border border-border/60 p-3.5 bg-background/50 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Volume2 className="h-3.5 w-3.5 text-blue-500" />
                  External Disturbance Factors
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {peakLag.disturbanceSummary}
                </p>
                <div className="text-[11px] text-primary/80 pt-1 flex items-center gap-1">
                  <span>Diagnostic tip:</span>
                  <span className="text-muted-foreground">Audible alerts, phone notifications, or roommate commotion.</span>
                </div>
              </div>

              {/* Factor 2: Distracted Internal State */}
              <div className="rounded-lg border border-border/60 p-3.5 bg-background/50 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Brain className="h-3.5 w-3.5 text-purple-500" />
                  Internal Fatigue & Circadian Dip
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {peakLag.distractedStateSummary}
                </p>
                <div className="text-[11px] text-primary/80 pt-1 flex items-center gap-1">
                  <span>Diagnostic tip:</span>
                  <span className="text-muted-foreground">Post-lunch digestion, dopamine drop, or passive lecture fatigue.</span>
                </div>
              </div>
            </div>

            {/* Actionable Tactical Solutions */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Tactical Solutions to Eliminate {peakLag.label} Lag
                </h5>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {peakLag.actionableSolutions.map((solution, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 p-3 bg-muted/10 hover:bg-muted/20 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        {solution.title}
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4">
                        {solution.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                      {solution.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action prompt */}
            {onNavigateTab && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Put this into action right now by starting a structured, short focus sprint.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateTab("focus")}
                  className="gap-2 text-xs w-full sm:w-auto"
                >
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  Launch 25m Focus Chamber
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Zero Pauses / Optimal Flow State Celebration */
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              Unbroken Flow: Zero Interruption Friction
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You haven't recorded significant pauses across any time window. Your focus stamina and environment isolation are performing at an elite level. Keep your current routine locked in!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

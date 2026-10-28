"use client"

import { useState, useMemo } from "react"
import {
  Clock,
  AlertTriangle,
  Sun,
  SunMedium,
  Sunset,
  Moon,
  Timer,
  ArrowRight,
  Volume2,
  Brain,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts"

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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
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

const pauseChartConfig: ChartConfig = {
  pauses: {
    label: "Pause Count",
    color: "hsl(var(--primary))",
  },
  minutes: {
    label: "Time Lost (min)",
    color: "hsl(var(--destructive))",
  },
}

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

  // Window data formatted for Recharts
  const windowChartData = useMemo(() => {
    if (!pausePatterns?.timeBreakdown) {
      return [
        { window: "morning", name: "Morning", hours: "05:00 - 11:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0 },
        { window: "afternoon", name: "Afternoon", hours: "12:00 - 16:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0 },
        { window: "evening", name: "Evening", hours: "17:00 - 20:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0 },
        { window: "night", name: "Late Night", hours: "21:00 - 04:59", pauses: 0, minutes: 0, isPeakLag: false, sessions: 0, avgPauses: 0, pct: 0 },
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
      }
    })
  }, [pausePatterns, totalPauses])

  // Hourly data formatted for Recharts
  const hourlyChartData = useMemo(() => {
    if (!pausePatterns?.hourlyBreakdown) return []
    return pausePatterns.hourlyBreakdown.map((h: HourlyPauseBreakdown) => {
      const isWindowPeak = peakLag && peakLag.window !== "none" && h.window === peakLag.window && h.pauses > 0
      return {
        hour: h.hour,
        name: h.label,
        window: h.window,
        pauses: h.pauses,
        minutes: h.totalPausedMinutes,
        isPeakLag: isWindowPeak,
      }
    })
  }, [pausePatterns, peakLag])

  const currentChartData = viewMode === "windows" ? windowChartData : hourlyChartData

  return (
    <Card className={`border-border bg-card ${className}`}>
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Pause Distribution & Fatigue Analysis
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Diagnostics on when pauses occur to identify external disruptions vs midday fatigue dips.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {totalPauses > 0 && peakLag && peakLag.window !== "none" ? (
              <Badge variant="outline" className="font-mono text-xs gap-1.5 py-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span>
                  Peak Lag: <strong className="font-semibold">{peakLag.label}</strong> ({peakLag.percentageOfTotalPauses}% of pauses)
                </span>
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-mono text-xs gap-1.5 py-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Zero Interruption Flow</span>
              </Badge>
            )}
          </div>
        </div>

        {/* View & Metric Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2">
          <Tabs value={viewMode} onValueChange={(val: any) => setViewMode(val)}>
            <TabsList className="h-8">
              <TabsTrigger value="windows" className="text-xs h-7">
                4 Time Windows
              </TabsTrigger>
              <TabsTrigger value="hourly" className="text-xs h-7">
                24-Hour Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={metric} onValueChange={(val: any) => setMetric(val)}>
            <TabsList className="h-8">
              <TabsTrigger value="pauses" className="text-xs h-7">
                Pause Count
              </TabsTrigger>
              <TabsTrigger value="minutes" className="text-xs h-7">
                Minutes Lost
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Main Chart with Shadcn ChartContainer */}
        <div className="w-full">
          <ChartContainer config={pauseChartConfig} className="h-[240px] w-full">
            <BarChart
              data={currentChartData}
              margin={{ left: -15, right: 10, top: 10, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey={metric}
                radius={[4, 4, 0, 0]}
                maxBarSize={viewMode === "windows" ? 56 : 18}
              >
                {currentChartData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={
                      entry.isPeakLag
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--primary))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 border-t pt-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" />
              Highlighted = Identified Peak Lag Window
            </span>
            <span>
              Total Lost to Pauses: <strong className="text-foreground font-mono">{totalPausedMinutes}m</strong> ({totalPauses} pauses)
            </span>
          </div>
        </div>

        {/* 4 Time Window Cards */}
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
              <Card
                key={item.window}
                className={`p-3 ${isLag ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    {icon}
                    {item.name}
                  </span>
                  {isLag && (
                    <Badge variant="destructive" className="text-[9px] py-0 px-1.5 h-4">
                      Lagging
                    </Badge>
                  )}
                  {!isLag && item.pauses === 0 && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 text-emerald-500 border-emerald-500/40">
                      Flow
                    </Badge>
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
                  <span className="text-xs font-mono font-medium text-destructive">
                    {item.minutes}m lost
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
                  <span>{item.sessions} session{item.sessions !== 1 ? "s" : ""}</span>
                  <span>{item.pct}% share</span>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Diagnostic Insights & Tactical Solutions */}
        {peakLag && peakLag.window !== "none" && totalPauses > 0 ? (
          <Card className="border-border bg-muted/10">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm font-semibold">
                      Lag Pattern Identified: {peakLag.label} Window ({peakLag.timeRange})
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    {peakLag.rootCauseAnalysis}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto">
                  {peakLag.pauseCount} pauses · {peakLag.totalPausedMinutes}m lost
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-3.5 bg-background">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Volume2 className="h-3.5 w-3.5 text-blue-500" />
                    External Disturbance Triggers
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {peakLag.disturbanceSummary}
                  </p>
                </Card>

                <Card className="p-3.5 bg-background">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Brain className="h-3.5 w-3.5 text-purple-500" />
                    Circadian Dip & Fatigue State
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {peakLag.distractedStateSummary}
                  </p>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Tactical Action Items
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {peakLag.actionableSolutions.map((solution, idx) => (
                    <Card key={idx} className="p-3 bg-background">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {idx + 1}
                          </span>
                          {solution.title}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {solution.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-5 leading-relaxed">
                        {solution.description}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>

              {onNavigateTab && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Overcome this lag right now with an isolated Pomodoro focus sprint.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateTab("focus")}
                    className="gap-2 text-xs w-full sm:w-auto"
                  >
                    <Timer className="h-3.5 w-3.5" />
                    Launch Focus Chamber
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold">Unbroken Focus Flow</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No significant pauses or disturbance clusters detected across any time window. Your study stamina is performing at a high level.
            </p>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}

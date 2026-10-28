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
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import {
  TrendingUp,
  Target,
  Zap,
  Award,
  Calculator,
  Brain,
  Calendar,
  Layers,
  CheckCircle2,
  LineChart as LineChartIcon,
  BarChart3,
  Sliders,
  Sparkles,
} from "lucide-react"
import {
  calculateGateMarksPrediction,
  GATE_RANK_THRESHOLDS,
  type GateRankThreshold,
} from "@/lib/gate-predictor"
import { RANKS, type RankInfo, type WeeklyStudyStats } from "@/lib/ranks"
import { useMockTests } from "@/hooks/useMockTests"
import { useUserData } from "@/hooks/useUserData"

export interface GateMarksPredictorProps {
  currentExp: number
  weeklyStudyStats: WeeklyStudyStats
  currentRank: RankInfo
  examDate?: string | Date | null
  onOpenAIMentor?: (prefill?: string) => void
  className?: string
}

const trajectoryChartConfig: ChartConfig = {
  predictedMarks: {
    label: "Predicted Marks",
    color: "hsl(var(--primary))",
  },
  actualMarks: {
    label: "Mock Test Score",
    color: "hsl(var(--chart-2))",
  },
  optimisticMarks: {
    label: "Optimistic Corridor (+1.5σ)",
    color: "hsl(var(--chart-1))",
  },
  conservativeMarks: {
    label: "Conservative Corridor (-1.2σ)",
    color: "hsl(var(--muted-foreground))",
  },
}

const velocityChartConfig: ChartConfig = {
  velocity: {
    label: "Improvement Velocity (Marks/wk)",
    color: "hsl(var(--primary))",
  },
}

export function GateMarksPredictor({
  currentExp,
  weeklyStudyStats,
  currentRank,
  examDate,
  onOpenAIMentor,
  className = "",
}: GateMarksPredictorProps) {
  const { reports, progress } = useUserData()
  const { attempts } = useMockTests()

  const [activeTab, setActiveTab] = useState<"trajectory" | "velocity">("trajectory")
  const [showSimulator, setShowSimulator] = useState(false)

  // Simulation parameters
  const [simExtraDailyHours, setSimExtraDailyHours] = useState<number>(2.0)
  const [simMockAccuracy, setSimMockAccuracy] = useState<number>(80)

  // Base prediction from empirical student telemetry
  const basePrediction = useMemo(() => {
    return calculateGateMarksPrediction({
      dailyReports: reports,
      mockAttempts: attempts,
      currentExp,
      weeklyStudyStats,
      examDate: examDate || progress.examDate,
      currentRank,
    })
  }, [reports, attempts, currentExp, weeklyStudyStats, examDate, progress.examDate, currentRank])

  // Simulated prediction when what-if slider is active
  const simulatedPrediction = useMemo(() => {
    if (!showSimulator) return null

    const simulatedWeeklyHours = Math.min(
      84,
      weeklyStudyStats.effectiveWeeklyHours + simExtraDailyHours * 7
    )
    const simulatedStats: WeeklyStudyStats = {
      ...weeklyStudyStats,
      effectiveWeeklyHours: simulatedWeeklyHours,
      dailyAvgHours: Number((simulatedWeeklyHours / 7).toFixed(1)),
    }

    return calculateGateMarksPrediction({
      dailyReports: reports,
      mockAttempts: [
        ...attempts,
        {
          marksObtained: simMockAccuracy,
          totalMarks: 100,
          scorePct: simMockAccuracy,
          attemptedAt: new Date(),
        },
      ],
      currentExp: currentExp + Math.round(simExtraDailyHours * 7 * 60 * 1.3),
      weeklyStudyStats: simulatedStats,
      examDate: examDate || progress.examDate,
    })
  }, [
    showSimulator,
    simExtraDailyHours,
    simMockAccuracy,
    reports,
    attempts,
    currentExp,
    weeklyStudyStats,
    examDate,
    progress.examDate,
  ])

  const activePrediction = simulatedPrediction || basePrediction
  const currentThreshold = activePrediction.currentThreshold
  const projectedThreshold = activePrediction.projectedThreshold

  const scoreDelta = simulatedPrediction
    ? Number((simulatedPrediction.projectedExamMarks - basePrediction.projectedExamMarks).toFixed(1))
    : 0

  const handleAskMentor = () => {
    if (onOpenAIMentor) {
      const prompt = `Based on my current GATE score prediction of ${activePrediction.currentMarks} / 100 (${currentThreshold.airRange}) and velocity of ${activePrediction.velocity > 0 ? "+" : ""}${activePrediction.velocity} marks/week, what are the top 3 highest-leverage conceptual areas I should focus on to reach SSS Rank (80+ marks)?`
      onOpenAIMentor(prompt)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Main Header Card ────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl font-bold tracking-tight">
                    GATE Marks & Trajectory Predictor
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    100-Mark Scale
                  </Badge>
                  {showSimulator && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      Simulation Active ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}M)
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-1">
                  Empirical score projection calibrated from mock accuracy, weekly study hours, and learning rate.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant={showSimulator ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSimulator(!showSimulator)}
                className="h-8 text-xs gap-1.5"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>{showSimulator ? "Close Simulator" : "Simulate What-If"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAskMentor}
                className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask AI Mentor</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── 4 KPI Metric Cards ──────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Current Score */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Current Predicted Marks
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-extrabold tracking-tight">
                    {activePrediction.currentMarks.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[10px] font-mono">
                    {activePrediction.currentRank.name}-Rank
                  </Badge>
                  <span className="text-xs font-medium text-foreground truncate">
                    {currentThreshold.airRange}
                  </span>
                </div>
                <Progress
                  value={activePrediction.currentMarks}
                  className="h-1.5"
                  aria-label="Current predicted marks out of 100"
                />
                <p className="text-[11px] text-muted-foreground font-mono">
                  Range: {activePrediction.predictedRange[0]}–{activePrediction.predictedRange[1]} M
                </p>
              </CardContent>
            </Card>

            {/* KPI 2: Velocity */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium uppercase tracking-wider">
                    Score Velocity
                  </CardDescription>
                  <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                    {activePrediction.momentumLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-extrabold tracking-tight">
                    {activePrediction.velocity > 0 ? "+" : ""}
                    {activePrediction.velocity.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">M / wk</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <span>Improvement per 7 days</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Acceleration: {activePrediction.acceleration > 0 ? "+" : ""}{activePrediction.acceleration.toFixed(2)} M/wk²
                </p>
              </CardContent>
            </Card>

            {/* KPI 3: Projected at Exam */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Projected at Exam
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-extrabold tracking-tight">
                    {activePrediction.projectedExamMarks.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {activePrediction.projectedRank.name}-Rank
                  </Badge>
                  <span className="text-xs font-medium text-foreground truncate">
                    {projectedThreshold.airRange}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {activePrediction.daysToExam !== null
                      ? `In ${activePrediction.daysToExam} days (${activePrediction.examDateStr})`
                      : "Extrapolated across next 6 weeks"}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* KPI 4: SSS-Rank Target */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium uppercase tracking-wider">
                    SSS Cutoff (80+ M)
                  </CardDescription>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    AIR 1–50
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-extrabold tracking-tight">
                    {activePrediction.daysToSSS === 0
                      ? "Achieved"
                      : activePrediction.daysToSSS !== null
                        ? `${activePrediction.daysToSSS}`
                        : "Plateau"}
                  </span>
                  {activePrediction.daysToSSS !== null && activePrediction.daysToSSS > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">days</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  <span>
                    {activePrediction.daysToSSS === 0
                      ? "Topper threshold reached"
                      : activePrediction.daysToSSS !== null
                        ? "Days needed at current velocity"
                        : "Increase hours to project"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  IISc CSA & Top 5 IITs CS target
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Interactive What-If Simulator ────────────────────────── */}
          {showSimulator && (
            <Card className="border-primary/30 bg-card">
              <CardHeader className="pb-3 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        What-If Scenario Simulator
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Adjust your daily study hours and mock accuracy to test projected score shifts.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      Simulated: {simulatedPrediction?.projectedExamMarks.toFixed(1)} / 100
                    </Badge>
                    <Badge className="font-mono text-xs">
                      {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}M Gain
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Slider 1: Extra Daily Hours */}
                  <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium">Additional Daily Study Time:</span>
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        +{simExtraDailyHours.toFixed(1)} hrs/day
                      </Badge>
                    </div>
                    <Slider
                      value={[simExtraDailyHours]}
                      min={0.5}
                      max={6.0}
                      step={0.5}
                      onValueChange={(val) => setSimExtraDailyHours(val[0])}
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Presets:</span>
                      {[1.0, 2.0, 3.0, 4.0].map((h) => (
                        <Button
                          key={h}
                          type="button"
                          variant={simExtraDailyHours === h ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSimExtraDailyHours(h)}
                          className="h-6 px-2 text-[10px] font-mono"
                        >
                          +{h}h
                        </Button>
                      ))}
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        = {(weeklyStudyStats.effectiveWeeklyHours + simExtraDailyHours * 7).toFixed(1)} hrs/wk total
                      </span>
                    </div>
                  </div>

                  {/* Slider 2: Target Mock Test Accuracy */}
                  <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium">Simulated Mock Test Accuracy:</span>
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        {simMockAccuracy}% score
                      </Badge>
                    </div>
                    <Slider
                      value={[simMockAccuracy]}
                      min={40}
                      max={95}
                      step={1}
                      onValueChange={(val) => setSimMockAccuracy(val[0])}
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Targets:</span>
                      {[65, 75, 85, 90].map((acc) => (
                        <Button
                          key={acc}
                          type="button"
                          variant={simMockAccuracy === acc ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSimMockAccuracy(acc)}
                          className="h-6 px-2 text-[10px] font-mono"
                        >
                          {acc}%
                        </Button>
                      ))}
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                        {simMockAccuracy >= 80 ? "AIR 1–50 Band" : simMockAccuracy >= 70 ? "Top 5 IITs" : "Qualified"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Graph Section with Shadcn Tabs & ChartContainer ──────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {activeTab === "trajectory"
                      ? "Score Trajectory & Confidence Corridor"
                      : "Weekly Improvement Velocity"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {activeTab === "trajectory"
                      ? "Historical trend combined with projected trajectory toward your target exam date"
                      : "Week-over-week score rate of change (Marks/week)"}
                  </CardDescription>
                </div>

                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="trajectory" className="text-xs gap-1.5 h-7">
                      <LineChartIcon className="h-3.5 w-3.5" />
                      <span>Marks Curve</span>
                    </TabsTrigger>
                    <TabsTrigger value="velocity" className="text-xs gap-1.5 h-7">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Velocity</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {activeTab === "trajectory" ? (
                <ChartContainer config={trajectoryChartConfig} className="h-[340px] w-full">
                  <ComposedChart
                    data={activePrediction.chartData}
                    margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 32, 50, 60, 70, 80, 100]}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(val) => `${val}M`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />

                    {/* Standard Benchmarks */}
                    <ReferenceLine
                      y={80}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      label={{
                        value: "SSS Rank (80M · AIR 1–50)",
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ReferenceLine
                      y={60}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3"
                      label={{
                        value: "S Rank (60M · Top NITs/IITs)",
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ReferenceLine
                      y={32}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="3 3"
                      label={{
                        value: "Cutoff (~32M)",
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "hsl(var(--destructive))",
                      }}
                    />

                    {/* Area for Predicted Marks */}
                    <Area
                      type="monotone"
                      dataKey="predictedMarks"
                      fill="var(--color-predictedMarks)"
                      fillOpacity={0.15}
                      stroke="var(--color-predictedMarks)"
                      strokeWidth={2.5}
                    />

                    {/* Confidence Corridor Lines */}
                    <Line
                      type="monotone"
                      dataKey="optimisticMarks"
                      stroke="var(--color-optimisticMarks)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="conservativeMarks"
                      stroke="var(--color-conservativeMarks)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <ChartContainer config={velocityChartConfig} className="h-[340px] w-full">
                  <BarChart
                    data={activePrediction.chartData}
                    margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(val) => `${val > 0 ? "+" : ""}${val}`}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                    <ReferenceLine
                      y={2.0}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="3 3"
                      label={{
                        value: "Target Pace (+2.0 M/wk)",
                        position: "insideTopLeft",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="velocity"
                      fill="var(--color-velocity)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ChartContainer>
              )}

              {/* Chart Legend Footer */}
              <div className="mt-3 flex flex-wrap items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary" />
                    Predicted Trajectory
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 border-t-2 border-dashed border-primary" />
                    Confidence Interval (±1.5σ)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-destructive" />
                    Cutoff Benchmark (32M)
                  </span>
                </div>
                <span className="font-mono text-foreground font-medium">
                  Projected: {activePrediction.projectedExamMarks.toFixed(1)} / 100
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── GATE Score Classification Table (Shadcn Table) ───────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <div>
                  <CardTitle className="text-base font-semibold">
                    GATE Marks & Hunter Rank Classification Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Standard 100-mark scoring thresholds mapped to admissions outlook and percentile brackets.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Rank Tier</TableHead>
                    <TableHead className="w-[130px]">Score Range</TableHead>
                    <TableHead className="w-[140px]">All India Rank</TableHead>
                    <TableHead>Target Admissions & PSU Outlook</TableHead>
                    <TableHead className="w-[120px] text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RANKS.slice()
                    .reverse()
                    .map((r) => {
                      const threshold = GATE_RANK_THRESHOLDS[r.name]
                      const isCurrent = activePrediction.currentRank.name === r.name
                      const isProjected = activePrediction.projectedRank.name === r.name

                      return (
                        <TableRow
                          key={r.name}
                          className={isCurrent ? "bg-primary/5 font-medium" : undefined}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isCurrent ? "default" : "outline"}
                                className="font-mono text-xs"
                              >
                                {r.name}
                              </Badge>
                              <span className="text-xs">{r.title}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {threshold.minMarks} – {threshold.maxMarks} M
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {threshold.airRange}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {threshold.targetOutlook}
                          </TableCell>
                          <TableCell className="text-right">
                            {isCurrent ? (
                              <Badge variant="default" className="text-[10px] font-mono">
                                Current
                              </Badge>
                            ) : isProjected ? (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                Projected
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {threshold.percentile.split(" ")[0]}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}

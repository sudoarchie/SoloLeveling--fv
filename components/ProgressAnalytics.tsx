"use client"

import { useState, useMemo } from "react"
import { format, subDays, isSameDay } from "date-fns"
import {
  Clock,
  Flame,
  Trophy,
  Brain,
  Zap,
  TrendingUp,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Moon,
  Calendar,
  Layers,
  ArrowRight,
  BookOpen,
  PenLine,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Sparkles,
  PieChart,
} from "lucide-react"
import {
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import type { DailyReport } from "@/hooks/useUserData"
import type { StreakData } from "@/hooks/useDailyQuests"
import { useMockTests } from "@/hooks/useMockTests"
import { usePomodoro, type FocusType } from "@/hooks/usePomodoro"
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition"
import { analyzeStudyPatterns, normalizeFocusType } from "@/lib/study-pattern"
import type { RankInfo, WeeklyStudyStats, RankProgressDetails } from "@/lib/ranks"
import { ActivityHeatmap } from "@/components/ActivityHeatmap"
import { MockTestInput } from "@/components/MockTestInput"
import { StreakTracker } from "@/components/StreakTracker"

export interface ProgressAnalyticsProps {
  dailyReports: DailyReport[]
  currentExp: number
  streak: StreakData
  currentRank: RankInfo
  nextRank: RankInfo | null
  weeklyStudyStats: WeeklyStudyStats
  rankProgress: RankProgressDetails
  soundEnabled: boolean
  onNavigateTab: (tab: string) => void
}

const studyChartConfig: ChartConfig = {
  practice: {
    label: "Practice Hours",
    color: "hsl(var(--primary))",
  },
  rankTarget: {
    label: "Rank Target (hrs)",
    color: "hsl(var(--destructive))",
  },
  lectures: {
    label: "Lectures",
    color: "hsl(var(--chart-2))",
  },
  topics: {
    label: "Topics",
    color: "hsl(var(--chart-3))",
  },
  exp: {
    label: "Daily EXP",
    color: "hsl(var(--chart-4))",
  },
}

const activityChartConfig: ChartConfig = {
  hours: {
    label: "Hours Invested",
    color: "hsl(var(--primary))",
  },
}

const focusChartConfig: ChartConfig = {
  sessions: {
    label: "Focus Sessions",
    color: "hsl(var(--primary))",
  },
  minutes: {
    label: "Focus Minutes",
    color: "hsl(var(--chart-1))",
  },
}

const mockChartConfig: ChartConfig = {
  scorePct: {
    label: "Score %",
    color: "hsl(var(--primary))",
  },
  accuracyPct: {
    label: "Accuracy %",
    color: "#06B6D4",
  },
}

export function ProgressAnalytics({
  dailyReports,
  currentExp,
  streak,
  currentRank,
  nextRank,
  weeklyStudyStats,
  rankProgress,
  soundEnabled,
  onNavigateTab,
}: ProgressAnalyticsProps) {
  // Timeframe filter state: 7, 14, or 30 days
  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(7)
  const [subTab, setSubTab] = useState<"overview" | "focus" | "mocks" | "retention">("overview")
  const [showMockLogger, setShowMockLogger] = useState(false)

  // Live hooks to pull actual real-time telemetry from all modules
  const { exams, attempts, bestScores } = useMockTests()
  const { history: pomodoroHistory, todayFocusMinutes } = usePomodoro()
  const spacedRepetition = useSpacedRepetition()

  // Target hours per day for the next rank (or current if max reached)
  const targetDailyHours = nextRank ? nextRank.minDailyAvgHours : currentRank.minDailyAvgHours
  const targetWeeklyHours = nextRank ? nextRank.minWeeklyHours : currentRank.minWeeklyHours

  // 1. Process daily study data for the selected timeframe
  const studyTimeline = useMemo(() => {
    let runningExp = 0
    const safeReports = dailyReports || []
    return Array.from({ length: timeframe }, (_, index) => {
      const date = subDays(new Date(), timeframe - index - 1)
      const report = safeReports.find((entry) => {
        if (!entry?.date) return false
        try {
          const d = entry.date instanceof Date ? entry.date : new Date(entry.date)
          return !isNaN(d.getTime()) && isSameDay(d, date)
        } catch {
          return false
        }
      })
      const practice = Number((report?.practiceHours ?? 0).toFixed(1))
      const exp = report?.expGained ?? 0
      runningExp += exp

      return {
        date: format(date, timeframe === 30 ? "d MMM" : "EEE, d"),
        fullDate: format(date, "yyyy-MM-dd"),
        practice,
        rankTarget: targetDailyHours,
        lectures: report?.lecturesCompleted ?? 0,
        topics: report?.topicsRevised ?? 0,
        exp,
        cumulativeExp: runningExp,
        morning: report?.morningSession ?? false,
        exercise: report?.exerciseDone ?? false,
        distraction: report?.distractionsLevel ?? "None",
        mentalState: report?.mentalState ?? "",
      }
    })
  }, [timeframe, dailyReports, targetDailyHours])

  // Summary statistics for the chosen timeframe
  const timeframeStats = useMemo(() => {
    const totalPractice = studyTimeline.reduce((sum, d) => sum + (d.practice || 0), 0)
    const totalLectures = studyTimeline.reduce((sum, d) => sum + (d.lectures || 0), 0)
    const totalTopics = studyTimeline.reduce((sum, d) => sum + (d.topics || 0), 0)
    const totalExp = studyTimeline.reduce((sum, d) => sum + (d.exp || 0), 0)
    const activeDays = studyTimeline.filter((d) => d.practice > 0 || d.lectures > 0 || d.topics > 0).length
    const denom = timeframe || 1
    const avgDailyPractice = Number((totalPractice / denom).toFixed(1))
    const morningCount = studyTimeline.filter((d) => d.morning).length
    const noDistractionCount = studyTimeline.filter((d) => d.distraction === "None").length

    return {
      totalPractice: Number(totalPractice.toFixed(1)),
      totalLectures,
      totalTopics,
      totalExp,
      activeDays,
      avgDailyPractice,
      morningPct: Math.round((morningCount / denom) * 100),
      focusPurityPct: Math.round((noDistractionCount / denom) * 100),
    }
  }, [studyTimeline, timeframe])

  // 2. Comprehensive breakdown: Quantity & Hours Invested by Focus Category
  const activityInvestment = useMemo(() => {
    const windowStart = subDays(new Date(), timeframe)
    const windowEnd = new Date()

    // Filter Pomodoro sessions within this timeframe
    const safePomodoro = pomodoroHistory || []
    const filteredSessions = safePomodoro.filter((s) => {
      const d = s?.completedAt || s?.startedAt
      if (!d) return false
      try {
        const sessionDate = new Date(d)
        return !isNaN(sessionDate.getTime()) && sessionDate >= windowStart && sessionDate <= windowEnd
      } catch {
        return false
      }
    })

    // Filter daily reports within this timeframe
    const safeReports = dailyReports || []
    const filteredReports = safeReports.filter((r) => {
      if (!r?.date) return false
      try {
        const d = r.date instanceof Date ? r.date : new Date(r.date)
        return !isNaN(d.getTime()) && d >= windowStart && d <= windowEnd
      } catch {
        return false
      }
    })

    // Filter mock attempts within this timeframe
    const safeAttempts = attempts || []
    const filteredAttempts = safeAttempts.filter((a) => {
      if (!a?.attemptedAt) return false
      try {
        const d = new Date(a.attemptedAt)
        return !isNaN(d.getTime()) && d >= windowStart && d <= windowEnd
      } catch {
        return false
      }
    })

    const totalLecturesFromReports = filteredReports.reduce((sum, r) => sum + (r.lecturesCompleted || 0), 0)
    const totalTopicsFromReports = filteredReports.reduce((sum, r) => sum + (r.topicsRevised || 0), 0)
    const totalMockAttempts = filteredAttempts.length

    let lectureMinutes = 0
    let lectureBlocks = 0

    let practiceMinutes = 0
    let practiceBlocks = 0

    let revisionMinutes = 0
    let revisionBlocks = 0

    let mockMinutes = 0
    let mockBlocks = 0

    let otherMinutes = 0
    let otherBlocks = 0

    filteredSessions.forEach((s) => {
      const mins = s?.durationMinutes || 25
      const fType = s?.focusType || normalizeFocusType(null, s?.description)

      switch (fType) {
        case "lecture":
          lectureMinutes += mins
          lectureBlocks++
          break
        case "practice":
          practiceMinutes += mins
          practiceBlocks++
          break
        case "revision":
          revisionMinutes += mins
          revisionBlocks++
          break
        case "mock_test":
          mockMinutes += mins
          mockBlocks++
          break
        case "other":
        default:
          otherMinutes += mins
          otherBlocks++
          break
      }
    })

    // Add mock test duration from exam attempts
    filteredAttempts.forEach((a) => {
      mockMinutes += a?.timeSpentMinutes || (a?.examType === "full_paper" ? 180 : 60)
    })

    // Reconcile with daily report quantities
    const estimatedLectureHours = Number((totalLecturesFromReports * 0.75).toFixed(1))
    const finalLectureHours = Number(Math.max(lectureMinutes / 60, estimatedLectureHours).toFixed(1))

    const estimatedRevisionHours = Number((totalTopicsFromReports * 0.4).toFixed(1))
    const finalRevisionHours = Number(Math.max(revisionMinutes / 60, estimatedRevisionHours).toFixed(1))

    const finalMockHours = Number((mockMinutes / 60).toFixed(1))
    const finalOtherHours = Number((otherMinutes / 60).toFixed(1))

    const totalReportedPracticeHours = filteredReports.reduce((sum, r) => sum + (r.practiceHours || 0), 0)
    const calculatedPracticeHours = Math.max(
      practiceMinutes / 60,
      totalReportedPracticeHours - (finalLectureHours + finalRevisionHours + finalMockHours + finalOtherHours),
    )
    const finalPracticeHours = Number(Math.max(0, calculatedPracticeHours).toFixed(1))

    const totalCalculatedHours =
      Number(
        (finalLectureHours + finalPracticeHours + finalRevisionHours + finalMockHours + finalOtherHours).toFixed(1),
      ) || 0

    const denom = totalCalculatedHours > 0 ? totalCalculatedHours : 1

    const categories = [
      {
        id: "lecture",
        label: "Lectures",
        hours: finalLectureHours,
        quantityNumber: totalLecturesFromReports || lectureBlocks,
        quantityLabel: `${totalLecturesFromReports} lectures completed`,
        sessionsCount: lectureBlocks,
        color: "#3B82F6",
        badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        pct: totalCalculatedHours > 0 ? Math.min(100, Math.round((finalLectureHours / denom) * 100)) : 0,
        icon: BookOpen,
        desc: "Theory videos, class concepts & lecture ingestion",
      },
      {
        id: "practice",
        label: "Practice & PYQs",
        hours: finalPracticeHours,
        quantityNumber: practiceBlocks || Math.round(finalPracticeHours * 8),
        quantityLabel: `${practiceBlocks || Math.round(finalPracticeHours * 8)} problem blocks`,
        sessionsCount: practiceBlocks,
        color: "#10B981",
        badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        pct: totalCalculatedHours > 0 ? Math.min(100, Math.round((finalPracticeHours / denom) * 100)) : 0,
        icon: PenLine,
        desc: "Active retrieval practice, PYQ solving & numericals",
      },
      {
        id: "revision",
        label: "Revision",
        hours: finalRevisionHours,
        quantityNumber: totalTopicsFromReports || revisionBlocks,
        quantityLabel: `${totalTopicsFromReports} topics revised`,
        sessionsCount: revisionBlocks,
        color: "#8B5CF6",
        badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        pct: totalCalculatedHours > 0 ? Math.min(100, Math.round((finalRevisionHours / denom) * 100)) : 0,
        icon: RotateCcw,
        desc: "Spaced repetition curve reviews & formula recall",
      },
      {
        id: "mock_test",
        label: "Mock Tests",
        hours: finalMockHours,
        quantityNumber: totalMockAttempts,
        quantityLabel: `${totalMockAttempts} exams attempted`,
        sessionsCount: mockBlocks + totalMockAttempts,
        color: "#F59E0B",
        badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        pct: totalCalculatedHours > 0 ? Math.min(100, Math.round((finalMockHours / denom) * 100)) : 0,
        icon: Trophy,
        desc: "Timed full exam simulations & subject test papers",
      },
      {
        id: "other",
        label: "Other Focus",
        hours: finalOtherHours,
        quantityNumber: otherBlocks,
        quantityLabel: `${otherBlocks} focus blocks`,
        sessionsCount: otherBlocks,
        color: "#64748B",
        badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        pct: totalCalculatedHours > 0 ? Math.min(100, Math.round((finalOtherHours / denom) * 100)) : 0,
        icon: SlidersHorizontal,
        desc: "Syllabus mapping, mistake notebook & strategy planning",
      },
    ]

    return {
      categories,
      totalHours: totalCalculatedHours,
      chartData: categories.map((c) => ({
        name: c.label,
        hours: c.hours,
        fill: c.color,
        quantity: c.quantityLabel,
      })),
    }
  }, [timeframe, pomodoroHistory, dailyReports, attempts])

  // 3. Study pattern intelligence (Pomodoro telemetry & stamina)
  const patternAnalysis = useMemo(() => {
    return analyzeStudyPatterns(pomodoroHistory || [])
  }, [pomodoroHistory])

  // Circadian window chart data
  const circadianChartData = useMemo(() => {
    const bd = patternAnalysis?.startTimings?.breakdown ?? { morning: 0, afternoon: 0, evening: 0, night: 0 }
    return [
      { window: "Morning", hours: "05:00 - 11:59", sessions: bd.morning ?? 0, fill: "#F59E0B" },
      { window: "Afternoon", hours: "12:00 - 16:59", sessions: bd.afternoon ?? 0, fill: "#3B82F6" },
      { window: "Evening", hours: "17:00 - 20:59", sessions: bd.evening ?? 0, fill: "#8B5CF6" },
      { window: "Night", hours: "21:00 - 04:59", sessions: bd.night ?? 0, fill: "#6366F1" },
    ]
  }, [patternAnalysis])

  // 4. Mock test analytics
  const mockStats = useMemo(() => {
    if (!attempts || attempts.length === 0) {
      return {
        totalAttempts: 0,
        avgScorePct: 0,
        bestScorePct: 0,
        avgAccuracy: null as number | null,
        totalTimeMinutes: 0,
        recentAttemptsData: [],
      }
    }

    const totalAttempts = attempts.length
    const avgScorePct = Math.round(
      attempts.reduce((sum, a) => sum + a.scorePct, 0) / totalAttempts,
    )
    const bestScorePct = Math.round(
      attempts.reduce((max, a) => Math.max(max, a.scorePct), 0),
    )

    const attemptsWithAcc = attempts.filter((a) => a.accuracyPct != null)
    const avgAccuracy =
      attemptsWithAcc.length > 0
        ? Math.round(
            attemptsWithAcc.reduce((sum, a) => sum + (a.accuracyPct || 0), 0) /
              attemptsWithAcc.length,
          )
        : null

    const totalTimeMinutes = attempts.reduce(
      (sum, a) => sum + (a.timeSpentMinutes || 0),
      0,
    )

    // Chronological attempt list for trajectory chart (oldest to newest, up to 15)
    const chronological = [...attempts]
      .sort((a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime())
      .slice(-15)
      .map((a, i) => ({
        index: i + 1,
        date: format(new Date(a.attemptedAt), "MMM d"),
        examName: a.examName,
        scorePct: Number(a.scorePct.toFixed(1)),
        accuracyPct: a.accuracyPct != null ? Number(a.accuracyPct.toFixed(1)) : null,
        marksObtained: a.marksObtained,
        totalMarks: a.totalMarks,
        platform: a.platform || "Platform",
      }))

    return {
      totalAttempts,
      avgScorePct,
      bestScorePct,
      avgAccuracy,
      totalTimeMinutes,
      recentAttemptsData: chronological,
    }
  }, [attempts])

  // 5. Spaced repetition retention stages
  const retentionStats = useMemo(() => {
    const allTopics = spacedRepetition.topics || []
    const total = allTopics.length
    const mastered = allTopics.filter((t) => t.mastered || t.stage >= 4).length
    const stage0 = allTopics.filter((t) => !t.mastered && t.stage === 0).length
    const stage1 = allTopics.filter((t) => !t.mastered && t.stage === 1).length
    const stage2 = allTopics.filter((t) => !t.mastered && t.stage === 2).length
    const stage3 = allTopics.filter((t) => !t.mastered && t.stage === 3).length

    // Subject breakdown
    const subjectMap: Record<string, number> = {}
    allTopics.forEach((t) => {
      const sub = t.subject || "General"
      subjectMap[sub] = (subjectMap[sub] || 0) + 1
    })

    const subjectList = Object.entries(subjectMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Difficulty breakdown
    const easyCount = allTopics.filter((t) => t.difficulty === "easy").length
    const mediumCount = allTopics.filter((t) => t.difficulty === "medium").length
    const hardCount = allTopics.filter((t) => t.difficulty === "hard").length

    return {
      total,
      mastered,
      masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0,
      funnel: [
        { stage: "Stage 1 (1d)", count: stage0, desc: "Immediate recall" },
        { stage: "Stage 2 (3d)", count: stage1, desc: "Early consolidation" },
        { stage: "Stage 3 (7d)", count: stage2, desc: "Mid-term stability" },
        { stage: "Stage 4 (21d)", count: stage3, desc: "Long-term lock-in" },
        { stage: "Mastered", count: mastered, desc: "Permanent memory" },
      ],
      subjectList,
      difficulty: { easy: easyCount, medium: mediumCount, hard: hardCount },
    }
  }, [spacedRepetition.topics])

  return (
    <div className="space-y-6">
      {/* ── Top Executive Metric Cards ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Study Velocity & Rank Target */}
        <Card className="relative overflow-hidden border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Study Velocity
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-primary border-primary/30">
                {currentRank.name}-Rank
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {weeklyStudyStats.dailyAvgHours.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground ml-1">h/day</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Target: {targetDailyHours.toFixed(1)}h/day</span>
              <span className="font-mono font-medium text-foreground">
                {weeklyStudyStats.effectiveWeeklyHours.toFixed(1)} / {targetWeeklyHours}h/wk
              </span>
            </div>
            <Progress
              value={Math.min(100, (weeklyStudyStats.effectiveWeeklyHours / targetWeeklyHours) * 100)}
              className="h-1.5"
            />
            <p className="text-[11px] text-muted-foreground truncate">
              {rankProgress.isTimeGated ? (
                <span className="text-amber-500 font-medium">
                  ⏳ Needs {rankProgress.hoursNeeded}h more this week for {nextRank?.name}-Rank
                </span>
              ) : rankProgress.isExpGated ? (
                <span className="text-primary font-medium">
                  ⚡ Needs {rankProgress.expNeeded.toLocaleString()} EXP for {nextRank?.name}-Rank
                </span>
              ) : (
                <span className="text-emerald-500 font-medium">
                  ✓ Pace qualifies for {nextRank?.name ?? currentRank.name}-Rank
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* 2. Focus Stamina & Telemetry */}
        <Card className="relative overflow-hidden border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Focus Stamina
              </span>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] ${
                  (patternAnalysis?.pausePatterns?.pauseFrequencyRisk ?? "LOW") === "LOW"
                    ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                    : (patternAnalysis?.pausePatterns?.pauseFrequencyRisk ?? "LOW") === "MODERATE"
                      ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                      : "border-rose-500/40 text-rose-500 bg-rose-500/10"
                }`}
              >
                {patternAnalysis?.pausePatterns?.pauseFrequencyRisk ?? "LOW"} RISK
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {patternAnalysis?.completedSessions ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {patternAnalysis?.totalSessions ?? 0} sessions
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Avg pauses per session</span>
              <span className="font-mono font-medium text-foreground">
                {patternAnalysis?.pausePatterns?.avgPausesPerSession ?? "0.0"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Primary window</span>
              <span className="font-medium text-foreground truncate max-w-[130px]">
                {(patternAnalysis?.startTimings?.primaryWindow ?? "Afternoon").split(" (")[0]}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {(patternAnalysis?.pausePatterns?.timingOfPauses?.earlyPausesCount ?? 0) > 0 ? (
                <span>⚠️ {patternAnalysis?.pausePatterns?.timingOfPauses?.earlyPausesCount} warmup pauses logged</span>
              ) : (
                <span>✓ Smooth flow entry without initial hesitation</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* 3. Mock Test Diagnostic Benchmark */}
        <Card className="relative overflow-hidden border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mock Diagnostics
              </span>
              <Badge variant="outline" className="font-mono text-[11px]">
                {mockStats.totalAttempts} Attempt{mockStats.totalAttempts !== 1 ? "s" : ""}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {mockStats.bestScorePct > 0 ? `${mockStats.bestScorePct}%` : "—"}
              <span className="text-sm font-normal text-muted-foreground ml-1">PB Score</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Average score</span>
              <span className="font-mono font-medium text-foreground">
                {mockStats.avgScorePct > 0 ? `${mockStats.avgScorePct}%` : "No attempts"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question accuracy</span>
              <span className="font-mono font-medium text-foreground">
                {mockStats.avgAccuracy !== null ? `${mockStats.avgAccuracy}%` : "N/A"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {mockStats.totalTimeMinutes > 0 ? (
                <span>{Math.round(mockStats.totalTimeMinutes / 60)}h spent solving under test conditions</span>
              ) : (
                <span>Ready to log your first full test</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* 4. Memory Retention & Spaced Repetition */}
        <Card className="relative overflow-hidden border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Retention Health
              </span>
              <Badge variant="outline" className="font-mono text-[11px] text-emerald-500 border-emerald-500/30">
                {retentionStats.masteryRate}% Mastered
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {retentionStats.mastered}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {retentionStats.total} topics
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={retentionStats.masteryRate} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Reviews due today</span>
              <span className="font-mono font-medium text-primary">
                {spacedRepetition.dueTopics.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {retentionStats.subjectList.length > 0
                ? `${retentionStats.subjectList.length} subjects in retention pipeline`
                : "Add weak topics to begin Ebbinghaus curve"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Section Navigation Sub-Tabs & Timeframe Filter ───────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
        <Tabs value={subTab} onValueChange={(val: any) => setSubTab(val)} className="w-full sm:w-auto">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              Study Velocity
            </TabsTrigger>
            <TabsTrigger value="focus" className="gap-1.5 text-xs sm:text-sm">
              <Timer className="h-4 w-4" />
              Focus & Stamina
            </TabsTrigger>
            <TabsTrigger value="mocks" className="gap-1.5 text-xs sm:text-sm">
              <Trophy className="h-4 w-4" />
              Mock Diagnostics
            </TabsTrigger>
            <TabsTrigger value="retention" className="gap-1.5 text-xs sm:text-sm">
              <Brain className="h-4 w-4" />
              Retention Curve
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {subTab === "overview" && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-xs text-muted-foreground mr-1">Timeframe:</span>
            {[
              { days: 7, label: "7D" },
              { days: 14, label: "14D" },
              { days: 30, label: "30D" },
            ].map(({ days, label }) => (
              <Button
                key={days}
                variant={timeframe === days ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(days as any)}
                className="h-8 px-2.5 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── TAB 1: Study Velocity & Effort Breakdown ─────────────────────── */}
      {subTab === "overview" && (
        <div className="space-y-6">
          {/* ── NEW: Hours & Quantity Invested by Focus Category (Lecture, Practice, Revision, Mock, Other) ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b bg-card/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    Hours & Quantity Invested by Focus Activity
                  </CardTitle>
                  <CardDescription>
                    Breakdown of study time and quantities achieved across your prep domains · Last {timeframe} days
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto">
                  {activityInvestment.totalHours} hrs total logged
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Category metric cards with quantities and hours invested */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {activityInvestment.categories.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <div
                      key={cat.id}
                      className="rounded-xl border p-3.5 bg-background space-y-2.5 hover:border-border transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Icon className="h-3.5 w-3.5" style={{ color: cat.color }} />
                          {cat.label}
                        </span>
                        <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${cat.badgeColor}`}>
                          {cat.pct}%
                        </Badge>
                      </div>

                      <div>
                        <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                          {cat.hours}
                          <span className="text-xs font-normal text-muted-foreground ml-1">hrs</span>
                        </p>
                        <p className="text-xs font-medium text-foreground/80 mt-0.5 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.quantityLabel}
                        </p>
                      </div>

                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, Math.min(100, cat.pct))}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>

                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {cat.desc}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Comparative Activity Investment Bar Chart */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-semibold text-foreground">Activity Hours Comparison</span>
                  <span className="text-muted-foreground">Distribution across focus domains</span>
                </div>
                <ChartContainer config={activityChartConfig} className="h-[140px] w-full">
                  <BarChart
                    data={activityInvestment.chartData}
                    layout="vertical"
                    margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" axisLine={false} tickLine={false} unit="h" fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      width={100}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                      {activityInvestment.chartData.map((entry, idx) => (
                        <Cell key={`act-cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Main Daily Practice Hours & Rank Target Chart */}
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Daily Practice Hours vs Rank Target
                  </CardTitle>
                  <CardDescription>
                    Pacing toward {nextRank ? `${nextRank.name}-Rank (${targetDailyHours}h/day)` : "Supreme Monarch"} · Last {timeframe} days
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                    Target: {targetDailyHours}h/day
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={studyChartConfig} className="h-[280px] w-full">
                  <ComposedChart data={studyTimeline} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      fontSize={11}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      unit="h"
                      domain={[
                        0,
                        (dataMax: number) => {
                          const max = typeof dataMax === "number" && !isNaN(dataMax) ? dataMax : 0
                          const target = typeof targetDailyHours === "number" && !isNaN(targetDailyHours) ? targetDailyHours : 8
                          return Math.max(Math.ceil(max + 1), Math.ceil(target + 1), 6)
                        },
                      ]}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={targetDailyHours}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="4 4"
                      label={{
                        value: `${nextRank?.name ?? "S"}-Rank Goal: ${targetDailyHours}h`,
                        position: "insideTopRight",
                        fill: "hsl(var(--destructive))",
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="practice"
                      fill="var(--color-practice)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </ComposedChart>
                </ChartContainer>
                <div className="mt-3 flex flex-wrap items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-primary" />
                      Hours Studied
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-3 bg-destructive" />
                      {nextRank ? `${nextRank.name}-Rank Target (${targetDailyHours}h)` : "Target"}
                    </span>
                  </div>
                  <span className="font-mono text-foreground font-medium">
                    Total: {timeframeStats.totalPractice}h (avg {timeframeStats.avgDailyPractice}h/day)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Habit Consistency & Focus Purity Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Habit & Flow Consistency</CardTitle>
                <CardDescription>Key behaviors driving retention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      Morning Study Starts
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {timeframeStats.morningPct}%
                    </span>
                  </div>
                  <Progress value={timeframeStats.morningPct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    Early sessions encode recall 25% faster during circadian peak.
                  </p>
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <Zap className="h-3.5 w-3.5 text-cyan-400" />
                      Distraction-Free Purity
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {timeframeStats.focusPurityPct}%
                    </span>
                  </div>
                  <Progress value={timeframeStats.focusPurityPct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    Percentage of logged days rated as zero distraction.
                  </p>
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      Active Streak
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {streak.currentStreak} days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Personal best: {streak.longestStreak} days · {streak.streakFreezes} freeze protection
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Charts: Lectures & Topics Bar + Cumulative EXP Line */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Lectures & Topics Completed</CardTitle>
                <CardDescription>Daily conceptual coverage · last {timeframe} days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={studyChartConfig} className="h-[220px] w-full">
                  <BarChart data={studyTimeline} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="lectures" fill="var(--color-lectures)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="topics" fill="var(--color-topics)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex justify-center gap-6 text-xs text-muted-foreground border-t pt-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-2))]" />
                    Lectures Finished ({timeframeStats.totalLectures})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-3))]" />
                    Topics Revised ({timeframeStats.totalTopics})
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">EXP Progression Curve</CardTitle>
                <CardDescription>Hunter growth trajectory · {currentExp.toLocaleString()} total EXP</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={studyChartConfig} className="h-[220px] w-full">
                  <AreaChart data={studyTimeline} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="exp"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#expGradient)"
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <span>+{timeframeStats.totalExp.toLocaleString()} EXP in period</span>
                  <span className="font-mono font-medium text-foreground">
                    Next Rank: {nextRank ? `${nextRank.minExp.toLocaleString()} EXP` : "Max Rank"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Heatmap */}
          <ActivityHeatmap dailyReports={dailyReports} weeks={5} />
        </div>
      )}

      {/* ── TAB 2: Focus & Stamina Diagnostics ───────────────────────────── */}
      {subTab === "focus" && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Circadian Focus Clock */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Circadian Study Window</CardTitle>
                    <CardDescription>When you initiate focus sessions</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Primary: {(patternAnalysis?.startTimings?.primaryWindow ?? "Afternoon").split(" (")[0]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={focusChartConfig} className="h-[240px] w-full">
                  <BarChart data={circadianChartData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="window" axisLine={false} tickLine={false} fontSize={11} />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                      {circadianChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t pt-3 text-center">
                  {circadianChartData.map((d) => (
                    <div key={d.window} className="rounded-md border p-2 bg-muted/10">
                      <p className="text-[11px] text-muted-foreground">{d.window}</p>
                      <p className="text-lg font-bold font-mono">{d.sessions}</p>
                      <p className="text-[10px] text-muted-foreground">{d.hours}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stamina & Friction Diagnostics */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Stamina & Interruption Health</CardTitle>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      (patternAnalysis?.pausePatterns?.pauseFrequencyRisk ?? "LOW") === "LOW"
                        ? "border-emerald-500/40 text-emerald-500"
                        : "border-amber-500/40 text-amber-500"
                    }`}
                  >
                    {patternAnalysis?.pausePatterns?.pauseFrequencyRisk ?? "LOW"} FRICTION
                  </Badge>
                </div>
                <CardDescription>Live telemetry from timer pauses & resumes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3.5 bg-muted/20 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Focus Assessment
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {patternAnalysis?.pausePatterns?.pauseFrequencyDescription ?? "Consistent focus rhythm."}
                  </p>
                </div>

                <div className="rounded-lg border p-3.5 bg-muted/20 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Pause Timing Diagnostic
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {patternAnalysis?.pausePatterns?.timingOfPauses?.diagnosticNote ?? "Telemetry indicates stable work blocks."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-md border p-2 bg-background">
                    <p className="text-[10px] text-muted-foreground">Total Pauses</p>
                    <p className="text-lg font-bold font-mono">{patternAnalysis?.pausePatterns?.totalPauses ?? 0}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-background">
                    <p className="text-[10px] text-muted-foreground">Avg Duration</p>
                    <p className="text-lg font-bold font-mono">{patternAnalysis?.pausePatterns?.avgPauseDurationMinutes ?? 0}m</p>
                  </div>
                  <div className="rounded-md border p-2 bg-background">
                    <p className="text-[10px] text-muted-foreground">Minutes Lost</p>
                    <p className="text-lg font-bold font-mono text-amber-500">{patternAnalysis?.pausePatterns?.totalPausedMinutes ?? 0}m</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("focus")}
                  className="w-full gap-2 text-xs"
                >
                  <Timer className="h-3.5 w-3.5" />
                  Enter Deep Work Chamber
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 3: Mock Test Diagnostic Analytics ────────────────────────── */}
      {subTab === "mocks" && (
        <div className="space-y-6">
          {mockStats.recentAttemptsData.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">Score & Accuracy Trajectory</CardTitle>
                  <CardDescription>Chronological performance across your logged test attempts</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    Best: {mockStats.bestScorePct}% · Avg: {mockStats.avgScorePct}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={mockChartConfig} className="h-[280px] w-full">
                  <LineChart data={mockStats.recentAttemptsData} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine
                      y={65}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      label={{ value: "GATE Cutoff Benchmark: 65%", position: "insideTopRight", fill: "#10B981", fontSize: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="scorePct"
                      stroke="var(--color-scorePct)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracyPct"
                      stroke="var(--color-accuracyPct)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="mt-3 flex justify-between items-center border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-primary" />
                      Score %
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-cyan-400" />
                      Accuracy %
                    </span>
                  </div>
                  <span className="font-mono">{mockStats.totalAttempts} total attempts tracked</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <Trophy className="mx-auto h-9 w-9 text-muted-foreground/60" />
                <h3 className="text-base font-semibold">No Mock Exams Logged Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Take full mock exams from Testbook, Made Easy, PW, or create personal subject-wise tests to track score trajectory.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" onClick={() => setShowMockLogger(true)}>
                    Log a Test Score
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigateTab("mocks")}>
                    Take Timed Question Bank
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collapsible Mock Test Input Logger */}
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Log External Mock Test or Add Exam Tracker</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMockLogger(!showMockLogger)}
                className="h-8 gap-1.5 text-xs text-muted-foreground"
              >
                {showMockLogger ? "Collapse" : "Open Logger"}
                {showMockLogger ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {showMockLogger && (
              <div className="pt-2">
                <MockTestInput soundEnabled={soundEnabled} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: Spaced Repetition Retention Curve ─────────────────────── */}
      {subTab === "retention" && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Ebbinghaus Retention Funnel */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Ebbinghaus Retention Funnel</CardTitle>
                  <Badge variant="outline" className="text-xs font-mono text-emerald-500">
                    {retentionStats.mastered} Mastered
                  </Badge>
                </div>
                <CardDescription>Topic progress along the 1d → 3d → 7d → 21d forgetting curve</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {retentionStats.funnel.map((item, idx) => {
                  const pct = retentionStats.total > 0 ? Math.round((item.count / retentionStats.total) * 100) : 0
                  return (
                    <div key={item.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.stage}</span>
                        <span className="font-mono text-muted-foreground">
                          {item.count} topics ({pct}%)
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-2 ${idx === 4 ? "[&>div]:bg-emerald-500" : ""}`}
                      />
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Subject Distribution & Difficulty Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Subject & Difficulty Spread</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {retentionStats.total} Total Topics
                  </Badge>
                </div>
                <CardDescription>Targeting weak areas across GATE domains</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Top Subjects Tracked</p>
                  {retentionStats.subjectList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {retentionStats.subjectList.map((s) => (
                        <Badge key={s.name} variant="secondary" className="text-xs gap-1.5 px-2.5 py-1">
                          <span>{s.name}</span>
                          <span className="font-mono text-primary font-bold">({s.count})</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No subjects added yet.</p>
                  )}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Desirable Difficulty Balance</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border p-2.5 bg-emerald-500/[0.04] border-emerald-500/20">
                      <p className="text-xs font-semibold text-emerald-500">Easy (1× EXP)</p>
                      <p className="text-xl font-bold font-mono mt-1">{retentionStats.difficulty.easy}</p>
                    </div>
                    <div className="rounded-lg border p-2.5 bg-amber-500/[0.04] border-amber-500/20">
                      <p className="text-xs font-semibold text-amber-500">Medium (1.5× EXP)</p>
                      <p className="text-xl font-bold font-mono mt-1">{retentionStats.difficulty.medium}</p>
                    </div>
                    <div className="rounded-lg border p-2.5 bg-rose-500/[0.04] border-rose-500/20">
                      <p className="text-xs font-semibold text-rose-500">Hard (2× EXP)</p>
                      <p className="text-xl font-bold font-mono mt-1">{retentionStats.difficulty.hard}</p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("reviews")}
                  className="w-full gap-2 text-xs pt-1"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Go to Active Reviews ({spacedRepetition.dueTopics.length} Due)
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

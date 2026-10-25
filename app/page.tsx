"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  Clock3,
  Settings,
  Volume2,
  VolumeX,
  BarChart3,
  Zap,
  Crown,
  Flame,
  LayoutDashboard,
  LogOut,
  GraduationCap,
  FileQuestion,
  Timer,
  Play,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  subDays,
  isSameDay,
} from "date-fns"
import {
  Bar,
  BarChart,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { useSoundEffects } from "@/hooks/useSoundEffects"
import { useDailyQuests } from "@/hooks/useDailyQuests"
import {
  useSpacedRepetition,
  type Difficulty,
} from "@/hooks/useSpacedRepetition"
import { DailyQuests } from "@/components/DailyQuests"
import { StreakTracker } from "@/components/StreakTracker"
import { ActivityHeatmap } from "@/components/ActivityHeatmap"
import { CommandConsole } from "@/components/CommandConsole"
import { ChangePasswordSettings } from "@/components/ChangePasswordSettings"
import { MockTestInput } from "@/components/MockTestInput"
import { MockQuestionBank } from "@/components/MockQuestionBank"
import { ReviewSchedule } from "@/components/ReviewSchedule"
import SubmissionPopup, { type LootDrop } from "@/components/SubmissionPopup"
import { useUserData, type DailyReport } from "@/hooks/useUserData"
import { useTheme } from "next-themes"
import { AIMentor } from "@/components/AIMentor"
import { DailyInsight } from "@/components/DailyInsight"
import { PomodoroTimer } from "@/components/PomodoroTimer"
import { QuickFocusWidget } from "@/components/QuickFocusWidget"
import { usePomodoro } from "@/hooks/usePomodoro"
import { Badge } from "@/components/ui/badge"
import {
  RANKS,
  getRank,
  getNextRank,
  getRankProgressDetails,
  calculateWeeklyStudyStats,
  type RankInfo,
} from "@/lib/ranks"
import RankUpgradeModal from "@/components/RankUpgradeModal"

const ranks: RankInfo[] = RANKS
const themes = [
  { name: "Blue", value: "blue", color: "hsl(221, 83%, 53%)" },
  { name: "Green", value: "green", color: "hsl(142, 76%, 36%)" },
  { name: "Purple", value: "purple", color: "hsl(262, 83%, 58%)" },
  { name: "Orange", value: "orange", color: "hsl(25, 95%, 53%)" },
  { name: "Red", value: "red", color: "hsl(0, 84%, 60%)" },
  { name: "Pink", value: "pink", color: "hsl(336, 75%, 40%)" },
]

const chartConfig = {
  lectures: { label: "Lectures", color: "hsl(var(--chart-1))" },
  topics: { label: "Topics", color: "hsl(var(--chart-2))" },
  practice: { label: "Practice", color: "hsl(var(--chart-3))" },
  exp: { label: "EXP", color: "hsl(var(--chart-4))" },
  morning: { label: "Morning", color: "hsl(var(--chart-5))" },
}

export default function GATETracker() {
  const [activeView, setActiveView] = useState("today")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showSubmissionPopup, setShowSubmissionPopup] = useState(false)
  const [lastExpGained, setLastExpGained] = useState(0)
  const [mentorPrefill, setMentorPrefill] = useState<string | undefined>(undefined)

  const { status: pomodoroStatus, timeLeft: pomodoroTimeLeft } = usePomodoro()
  const isPomodoroRunning = pomodoroStatus === "running"

  // All persistent state lives in Supabase (user_progress + daily_reports)
  const {
    progress,
    reports: dailyReports,
    loading: userDataLoading,
    saveProgress,
    saveReport,
  } = useUserData()

  const currentExp = progress.currentExp
  const examDate = progress.examDate
  const soundEnabled = progress.soundEnabled
  const selectedTheme = progress.selectedTheme
  const activeTitle = progress.activeTitle

  // Wrapper setters that persist to Supabase
  const setCurrentExp = (value: number | ((prev: number) => number)) =>
    saveProgress((prev) => ({
      currentExp: typeof value === "function" ? value(prev.currentExp) : value,
    }))
  const setExamDate = (date: Date | null) => saveProgress({ examDate: date })
  const setSoundEnabled = (enabled: boolean) =>
    saveProgress({ soundEnabled: enabled })
  const setSelectedTheme = (theme: string) =>
    saveProgress({ selectedTheme: theme })
  const setUnlockedTitles = (
    value: string[] | ((prev: string[]) => string[]),
  ) =>
    saveProgress((prev) => ({
      unlockedTitles:
        typeof value === "function" ? value(prev.unlockedTitles) : value,
    }))
  const setActiveTitle = (title: string | null) =>
    saveProgress({ activeTitle: title })
  const setUnlockedCosmetics = (
    value: string[] | ((prev: string[]) => string[]),
  ) =>
    saveProgress((prev) => ({
      unlockedCosmetics:
        typeof value === "function" ? value(prev.unlockedCosmetics) : value,
    }))

  const sounds = useSoundEffects(soundEnabled)
  const { theme, setTheme } = useTheme()
  const changeView = (view: string) => {
    sounds.buttonClick()
    setActiveView(view)
  }
  const changeSound = (enabled: boolean) => {
    setSoundEnabled(enabled)
    if (enabled) requestAnimationFrame(() => sounds.toggleSwitch())
  }
  const router = useRouter()
  const {
    quests,
    streak,
    loading: questsLoading,
    reward,
    allDone,
    updateProgress,
    dismissReward,
  } = useDailyQuests()
  const spacedRepetition = useSpacedRepetition()

  const [studiedTopics, setStudiedTopics] = useState<string[]>([])
  const [topicDifficulty, setTopicDifficulty] = useState<Difficulty>("medium")
  const [reviewedToday, setReviewedToday] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    lecturesCompleted: 0,
    topicsRevised: 0,
    practiceHours: 0,
    morningSession: false,
    exerciseDone: false,
    distractionsLevel: "None",
    mentalState: "",
  })

  const logInitialized = useRef(false)
  useEffect(() => {
    if (userDataLoading) return
    const today = dailyReports.find((report) =>
      isSameDay(report.date, new Date()),
    )
    if (!today) return

    if (!logInitialized.current) {
      logInitialized.current = true

      const todayStr = format(new Date(), "yyyy-MM-dd")
      const savedManualKey = `gate_tracker_manual_log_${todayStr}`
      let savedManual: any = null
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(savedManualKey)
          if (raw) savedManual = JSON.parse(raw)
        } catch {}
      }

      if (savedManual) {
        setFormData({
          lecturesCompleted: savedManual.lecturesCompleted ?? today.lecturesCompleted,
          topicsRevised: savedManual.topicsRevised ?? today.topicsRevised,
          practiceHours: savedManual.practiceHours ?? 0,
          morningSession: savedManual.morningSession ?? today.morningSession,
          exerciseDone: savedManual.exerciseDone ?? today.exerciseDone,
          distractionsLevel: savedManual.distractionsLevel ?? today.distractionsLevel,
          mentalState: savedManual.mentalState ?? today.mentalState,
        })
      } else {
        // When no manual log has been submitted today in this browser, initialize form cleanly.
        // Never pre-fill practice hours from background (pomodoro / mock tests / seeds).
        setFormData({
          lecturesCompleted: today.lecturesCompleted,
          topicsRevised: today.topicsRevised,
          practiceHours: 0,
          morningSession: today.morningSession,
          exerciseDone: today.exerciseDone,
          distractionsLevel: today.distractionsLevel,
          mentalState: today.mentalState,
        })
      }
    }
  }, [dailyReports, userDataLoading])

  // Calculate weekly study stats (rolling 7-day window, daily average, effective weekly hours)
  const weeklyStudyStats = useMemo(() => {
    return calculateWeeklyStudyStats(dailyReports)
  }, [dailyReports])

  // Get current rank taking BOTH cumulative EXP AND weekly study time into account
  const currentRank = useMemo(() => {
    return getRank(currentExp, weeklyStudyStats.effectiveWeeklyHours)
  }, [currentExp, weeklyStudyStats.effectiveWeeklyHours])

  const nextRank = useMemo(() => {
    return getNextRank(currentRank.name)
  }, [currentRank.name])

  // Calculate days remaining
  const daysRemaining = examDate
    ? Math.max(0, differenceInDays(examDate, new Date()))
    : 0

  // Calculate detailed progress & requirements toward next rank
  const rankProgress = useMemo(() => {
    return getRankProgressDetails(
      currentExp,
      weeklyStudyStats.effectiveWeeklyHours,
      currentRank,
      nextRank,
    )
  }, [currentExp, weeklyStudyStats.effectiveWeeklyHours, currentRank, nextRank])

  const expProgress = rankProgress.overallProgress

  // Upgrade celebration modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeModalData, setUpgradeModalData] = useState<{
    oldRank: RankInfo
    newRank: RankInfo
    currentExp: number
    weeklyHours: number
  } | null>(null)

  // Trigger rank upgrade modal celebration
  const triggerUpgradeCelebration = useCallback(
    (
      oldRankToCompare: RankInfo,
      newExp: number,
      newWeeklyHours: number,
    ) => {
      const candidateRank = getRank(newExp, newWeeklyHours)
      const oldRankIdx = RANKS.findIndex((r) => r.name === oldRankToCompare.name)
      const newRankIdx = RANKS.findIndex((r) => r.name === candidateRank.name)

      if (newRankIdx > oldRankIdx) {
        setUpgradeModalData({
          oldRank: oldRankToCompare,
          newRank: candidateRank,
          currentExp: newExp,
          weeklyHours: newWeeklyHours,
        })
        setShowUpgradeModal(true)

        toast.success(`Hunter Awakening! Upgraded to ${candidateRank.name}-Rank`, {
          description: `${candidateRank.title} · Keep up your weekly consistency!`,
        })

        if (soundEnabled) {
          sounds.levelUp()
        }
      }
    },
    [soundEnabled, sounds],
  )

  // Apply theme colors
  useEffect(() => {
    const root = document.documentElement
    const selectedThemeData = themes.find((t) => t.value === selectedTheme)
    if (selectedThemeData) {
      root.style.setProperty(
        "--primary",
        selectedThemeData.color
          .replace("hsl(", "")
          .replace(")", "")
          .replace(/,/g, ""),
      )
    }
  }, [selectedTheme])

  // Calculate EXP gain exclusively from manual log inputs
  const calculateFormExp = useCallback(
    (
      data: {
        lecturesCompleted: number
        topicsRevised: number
        morningSession: boolean
        exerciseDone: boolean
        distractionsLevel: string
        practiceHours?: number
      },
      manualPracticeHours?: number,
    ) => {
      let exp = 0
      exp += (data.lecturesCompleted || 0) * 50
      exp += (data.topicsRevised || 0) * 30
      const hours =
        manualPracticeHours !== undefined
          ? manualPracticeHours
          : (data.practiceHours || 0)
      exp += Math.max(0, hours) * 100
      exp += data.morningSession ? 50 : 0
      exp += data.exerciseDone ? 30 : 0

      // Distraction penalty
      const distractionPenalty = {
        None: 0,
        Low: -20,
        Medium: -50,
        High: -100,
      }
      exp +=
        distractionPenalty[
          data.distractionsLevel as keyof typeof distractionPenalty
        ] || 0

      return Math.max(0, exp)
    },
    [],
  )

  // Handle form submission non-destructively: preserve Focus, Quest, and Mock test EXP
  const handleSubmit = async () => {
    try {
      const todayReport = dailyReports.find((report) =>
        isSameDay(report.date, new Date()),
      )

      const todayStr = format(new Date(), "yyyy-MM-dd")
      const savedManualKey = `gate_tracker_manual_log_${todayStr}`
      let savedManual: any = null
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(savedManualKey)
          if (raw) savedManual = JSON.parse(raw)
        } catch {}
      }

      // Previous manual log contributions (if any)
      const prevManualPracticeHours = Number(savedManual?.practiceHours ?? 0)
      const prevManualExp = Number(savedManual?.manualExp ?? 0)

      const newManualPracticeHours = Number(formData.practiceHours || 0)
      const newManualExp = calculateFormExp(formData, newManualPracticeHours)

      // Other sources EXP (Focus Pomodoro sessions, Quests, Mock tests) already earned today
      const otherSourcesExp = todayReport
        ? Math.max(0, todayReport.expGained - prevManualExp)
        : 0

      // Feed studied topics into spaced repetition
      let topicFeedback = { reviewed: 0, added: 0, exp: 0 }
      if (studiedTopics.length > 0) {
        topicFeedback = await spacedRepetition.logStudiedTopics(
          studiedTopics,
          topicDifficulty,
        )
        // Track which topics were reviewed today for the checklist
        const reviewedIds = spacedRepetition.dueTopics
          .filter((t) =>
            studiedTopics.some((s) => s.toLowerCase() === t.name.toLowerCase()),
          )
          .map((t) => t.id)
        setReviewedToday((prev) => {
          const next = new Set(prev)
          reviewedIds.forEach((id) => next.add(id))
          return next
        })
      }

      // Delta of practice hours from this manual form
      const deltaPractice = newManualPracticeHours - prevManualPracticeHours
      const existingPracticeHours = Number(todayReport?.practiceHours ?? 0)
      const finalPracticeHours = Number(
        Math.max(0, existingPracticeHours + deltaPractice).toFixed(1),
      )

      // Final total EXP for today: other sources + new manual form EXP + topic review EXP
      const finalExpGained = otherSourcesExp + newManualExp + topicFeedback.exp

      // Delta added to user_progress.currentExp
      const expDelta = newManualExp - prevManualExp + topicFeedback.exp

      const finalTopicsRevised = Math.max(
        Number(formData.topicsRevised || 0),
        topicFeedback.reviewed,
      )

      const newReport: DailyReport = {
        date: new Date(),
        ...formData,
        topicsRevised: finalTopicsRevised,
        practiceHours: finalPracticeHours,
        expGained: finalExpGained,
      }

      const oldRank = currentRank
      await saveReport(newReport)

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            savedManualKey,
            JSON.stringify({
              ...formData,
              manualExp: newManualExp,
              submittedAt: new Date().toISOString(),
            }),
          )
        } catch {}
      }

      if (expDelta !== 0) {
        await setCurrentExp((prev) => Math.max(0, prev + expDelta))
      }

      // Play sound effects
      if (soundEnabled) {
        sounds.formSubmit()
        if (newManualExp > 0 || topicFeedback.exp > 0) {
          setTimeout(() => sounds.expGain(), 200)
        }
      }

      // Show the submission popup with the exp gained from this log session
      setLastExpGained(Math.max(0, newManualExp + topicFeedback.exp))
      setShowSubmissionPopup(true)

      // Check for rank up (considering both new EXP and updated weekly study hours)
      const newExp = currentExp + expDelta
      const updatedReports = [
        ...dailyReports.filter((r) => !isSameDay(r.date, new Date())),
        newReport,
      ]
      const newWeeklyStats = calculateWeeklyStudyStats(updatedReports)
      triggerUpgradeCelebration(
        oldRank,
        newExp,
        newWeeklyStats.effectiveWeeklyHours,
      )

      // Keep today’s saved values available for later edits.
      setStudiedTopics([])

      // Topic feedback toast — includes variable EXP from difficulty
      if (topicFeedback.added > 0 || topicFeedback.reviewed > 0) {
        const parts = []
        if (topicFeedback.added > 0)
          parts.push(
            `${topicFeedback.added} topic${topicFeedback.added > 1 ? "s" : ""} scheduled for review`,
          )
        if (topicFeedback.reviewed > 0)
          parts.push(
            `${topicFeedback.reviewed} review${topicFeedback.reviewed > 1 ? "s" : ""} advanced (+${topicFeedback.exp} EXP)`,
          )
        toast.success("Review schedule updated", {
          description: parts.join(" • "),
        })
      }
    } catch {
      toast.error("Couldn’t save your day", {
        description: "Your entry is still here. Please try again.",
      })
    }
  }

  // Calculate live preview of EXP that this log entry will add
  const formExpPreview = useMemo(() => {
    return calculateFormExp(formData)
  }, [calculateFormExp, formData])

  // Apply claimed loot: bonus EXP + reward effects (titles, cosmetics, streak freezes)
  const handleLootClaimed = (loot: LootDrop) => {
    // Bonus EXP counts toward total
    const oldRankSnapshot = currentRank
    const newExp = currentExp + loot.bonusExp
    setCurrentExp((prev) => prev + loot.bonusExp)
    if (soundEnabled) setTimeout(() => sounds.expGain(), 150)
    triggerUpgradeCelebration(
      oldRankSnapshot,
      newExp,
      weeklyStudyStats.effectiveWeeklyHours,
    )

    if (!loot.reward) return

    switch (loot.reward.kind) {
      case "title": {
        const title = loot.reward.value
        setUnlockedTitles((prev) =>
          prev.includes(title) ? prev : [...prev, title],
        )
        setActiveTitle(title)
        break
      }
      case "cosmetic": {
        const cosmetic = loot.reward.value
        setUnlockedCosmetics((prev) =>
          prev.includes(cosmetic) ? prev : [...prev, cosmetic],
        )
        break
      }
      case "streakFreeze":
        // Streak freeze is granted via the quest system's streak row
        grantStreakFreeze()
        break
      case "avatar":
        // Reserved for future avatar system
        break
    }
  }

  // Grant a streak freeze through Supabase (best-effort; requires signed-in user)
  const grantStreakFreeze = async () => {
    try {
      const { createClient } = await import("@/utils/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      const { data: row } = await supabase
        .from("streaks")
        .select("streak_freezes")
        .eq("user_id", data.user.id)
        .maybeSingle()
      if (row) {
        await supabase
          .from("streaks")
          .update({ streak_freezes: (row.streak_freezes ?? 0) + 1 })
          .eq("user_id", data.user.id)
      }
    } catch (e) {
      console.warn("Could not grant streak freeze:", e)
    }
  }

  // Tick a review off the to-do checklist in ReviewSchedule.
  // success=true → schedule advances + EXP awarded; success=false → spacing resets.
  const handleChecklistReview = async (id: string, success: boolean) => {
    sounds.unlock()
    const exp = await spacedRepetition.completeReview(id, success)
    if (success) {
      setReviewedToday((prev) => new Set(prev).add(id))
      if (exp > 0) {
        const oldRankSnapshot = currentRank
        const nextExp = currentExp + exp
        setCurrentExp((prev) => prev + exp)
        if (soundEnabled) setTimeout(() => sounds.expGain(), 150)
        triggerUpgradeCelebration(
          oldRankSnapshot,
          nextExp,
          weeklyStudyStats.effectiveWeeklyHours,
        )
      }
    }
  }

  const getChartData = (days: number) =>
    Array.from({ length: days }, (_, index) => {
      const date = subDays(new Date(), days - index - 1)
      const report = dailyReports.find((entry) => isSameDay(entry.date, date))
      return {
        date: format(date, "MMM d"),
        lectures: report?.lecturesCompleted ?? 0,
        topics: report?.topicsRevised ?? 0,
        practice: Number((report?.practiceHours ?? 0).toFixed(1)),
        exp: report?.expGained ?? 0,
      }
    })

  const getWeeklyStats = () => {
    const thisWeekStart = startOfWeek(new Date())
    const thisWeekEnd = endOfWeek(new Date())
    const thisWeekReports = dailyReports.filter((report) =>
      isWithinInterval(report.date, { start: thisWeekStart, end: thisWeekEnd }),
    )

    return {
      totalExp: thisWeekReports.reduce((sum, r) => sum + r.expGained, 0),
      totalLectures: thisWeekReports.reduce(
        (sum, r) => sum + r.lecturesCompleted,
        0,
      ),
      totalTopics: thisWeekReports.reduce((sum, r) => sum + r.topicsRevised, 0),
      totalPractice: Number(
        thisWeekReports
          .reduce((sum, r) => sum + (r.practiceHours || 0), 0)
          .toFixed(1),
      ),
      activeDays: thisWeekReports.length,
      avgExp:
        thisWeekReports.length > 0
          ? Math.round(
              thisWeekReports.reduce((sum, r) => sum + r.expGained, 0) /
                thisWeekReports.length,
            )
          : 0,
    }
  }

  const weeklyStats = getWeeklyStats()

  // Redirect to signin if the user signs out from the navbar while on this page
  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/signin")
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  // Gate the dashboard behind auth + data load
  if (userDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Zap className="h-8 w-8 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">
            Loading your workspace…
          </p>
        </div>
      </div>
    )
  }

  const dueCount = spacedRepetition.dueTopics.length
  const todayReport = dailyReports.find((report) =>
    isSameDay(report.date, new Date()),
  )
  const todayDateStr = format(new Date(), "yyyy-MM-dd")
  const hasSavedManualLog =
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem(`gate_tracker_manual_log_${todayDateStr}`))
  const hasReportToday = Boolean(
    hasSavedManualLog ||
      (todayReport &&
        (todayReport.lecturesCompleted > 0 ||
          todayReport.topicsRevised > 0 ||
          todayReport.morningSession ||
          todayReport.exerciseDone ||
          Boolean(todayReport.mentalState))),
  )
  const viewCopy: Record<string, { title: string; description: string }> = {
    today: {
      title: "Make room for progress.",
      description: "One focused session at a time. Let’s make today count.",
    },
    focus: {
      title: "Deep work chamber.",
      description: "25m, 90m, or 3-hour uninterrupted deep focus with live AI context.",
    },
    reviews: {
      title: "Keep what you’ve learned.",
      description: "A little recall today makes tomorrow easier.",
    },
    progress: {
      title: "Small steps. Real growth.",
      description: "See how your preparation is coming together.",
    },
    mocks: {
      title: "Take a real timed mock.",
      description: "Solve under exam conditions and earn the biggest EXP reward.",
    },
    mentor: {
      title: "Your AI study coach.",
      description: "Personalized analysis, strategy, and guidance powered by AI.",
    },
  }

  return (
    <Tabs
      value={activeView}
      onValueChange={changeView}
      className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <aside className="border-b bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5 lg:px-6 lg:py-8">
          <a
            href="/"
            className="flex items-center gap-3"
            aria-label="GATE Tracker home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              GATE
              <span className="font-normal text-muted-foreground">
                {" "}
                / tracker
              </span>
            </span>
          </a>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            className="lg:hidden"
          >
            <Settings />
          </Button>
        </div>
        <div className="px-4 pb-3 lg:px-4 lg:pt-5">
          <p className="mb-3 hidden px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground lg:block">
            Your workspace
          </p>
          <TabsList
            aria-label="Workspace navigation"
            className="grid h-auto w-full grid-cols-6 gap-1 bg-transparent p-0 lg:flex lg:flex-col lg:items-stretch"
          >
            {[
              { value: "today", label: "Today", icon: LayoutDashboard },
              { value: "focus", label: "Focus", icon: Timer },
              { value: "reviews", label: "Reviews", icon: BookOpen },
              { value: "mocks", label: "Mock tests", icon: FileQuestion },
              { value: "mentor", label: "AI Mentor", icon: Brain },
              { value: "progress", label: "Progress", icon: BarChart3 },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-11 gap-2 rounded-lg px-2 text-xs text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-3 sm:text-sm lg:justify-start"
              >
                <Icon className="hidden h-4 w-4 sm:block" />
                <span>{label}</span>
                {value === "focus" && isPomodoroRunning && (
                  <span className="ml-auto hidden rounded-md bg-emerald-500/15 text-emerald-500 px-1.5 py-0.5 text-[11px] font-mono tabular-nums lg:inline">
                    {Math.floor(pomodoroTimeLeft / 60)}m
                  </span>
                )}
                {value === "reviews" && dueCount > 0 && (
                  <span className="ml-auto hidden rounded-md bg-primary/10 px-1.5 py-0.5 text-xs tabular-nums lg:inline">
                    {dueCount}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="mt-auto hidden space-y-5 p-5 lg:block">
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {currentRank.name}
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">{currentRank.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {currentExp.toLocaleString()} EXP · {weeklyStudyStats.effectiveWeeklyHours.toFixed(1)}h/wk
                </p>
              </div>
            </div>

            {/* Rank Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Rank Progress</span>
                <span className="font-mono">{rankProgress.overallProgress}%</span>
              </div>
              <Progress
                value={rankProgress.overallProgress}
                aria-label="Progress to next rank"
                className="h-1.5"
              />
            </div>

            {/* Next Rank & Time Gate Status */}
            <div className="mt-2.5 text-xs text-muted-foreground">
              {nextRank ? (
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>Next: {nextRank.name}-Rank ({nextRank.title})</span>
                  </div>
                  {rankProgress.isTimeGated ? (
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 px-1.5 py-0 mt-1">
                      ⏳ Needs {rankProgress.hoursNeeded}h more study this week
                    </Badge>
                  ) : rankProgress.isExpGated ? (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 px-1.5 py-0 mt-1">
                      ⚡ Needs {rankProgress.expNeeded.toLocaleString()} EXP
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Needs {rankProgress.expNeeded.toLocaleString()} EXP & {nextRank.minWeeklyHours}h/wk study
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-amber-400 font-medium">👑 Highest rank achieved!</p>
              )}
            </div>

            {activeTitle && (
              <p className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
                <Crown className="h-3.5 w-3.5 shrink-0" />
                {activeTitle}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={() => setSettingsOpen(true)}
              className="w-full justify-start text-muted-foreground"
            >
              <Settings />
              Settings
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const { error } = await createClient().auth.signOut()
                if (error) {
                  toast.error("Couldn’t sign out. Please try again.")
                  return
                }
                router.push("/signin")
                router.refresh()
              }}
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main id="main-content" className="min-w-0">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b px-5 py-3 text-sm sm:px-8 lg:px-10">
          <span className="font-medium">
            {activeView === "today"
              ? "Today"
              : activeView === "focus"
                ? "Deep Work Pomodoro"
                : activeView === "reviews"
                  ? "Review schedule"
                  : activeView === "mocks"
                    ? "Mock tests"
                    : activeView === "mentor"
                      ? "AI Mentor"
                      : "Your progress"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                soundEnabled ? "Mute sound effects" : "Enable sound effects"
              }
              aria-pressed={soundEnabled}
              title={soundEnabled ? "Sound on" : "Sound off"}
              onClick={() => changeSound(!soundEnabled)}
              className="h-9 w-9 text-muted-foreground"
            >
              {soundEnabled ? <Volume2 /> : <VolumeX />}
            </Button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <CalendarDays className="h-4 w-4" />
              {examDate
                ? `${daysRemaining} days until your exam`
                : "Set your exam date"}
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="mb-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {viewCopy[activeView].title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {viewCopy[activeView].description}
            </p>
          </div>

          <TabsContent value="today" className="mt-0 space-y-7">
            <DailyInsight
              plan={progress.plan}
              onOpenChat={() => changeView("mentor")}
            />
            <QuickFocusWidget
              onOpenFocusTab={() => changeView("focus")}
              onOpenAIMentor={(prefill) => {
                setMentorPrefill(prefill)
                changeView("mentor")
              }}
            />
            <div className="grid grid-cols-3 divide-x rounded-xl border bg-card py-5">
              <div className="px-4 sm:px-6">
                <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Flame className="hidden h-4 w-4 sm:block" />
                  Study streak
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {streak.currentStreak}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    days
                  </span>
                </p>
              </div>
              <div className="px-4 sm:px-6">
                <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="hidden h-4 w-4 sm:block" />
                  This week
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {weeklyStats.totalPractice}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    hrs
                  </span>
                </p>
              </div>
              <div className="px-4 sm:px-6">
                <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <BookOpen className="hidden h-4 w-4 sm:block" />
                  Reviews due
                </p>
                <button
                  onClick={() => changeView("reviews")}
                  className="flex items-center gap-3 text-2xl font-semibold tracking-tight tabular-nums hover:text-primary"
                  aria-label={`View ${dueCount} reviews due`}
                >
                  {dueCount}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <CommandConsole
                logData={formData}
                onLogChange={(patch) =>
                  setFormData((prev) => ({ ...prev, ...patch }))
                }
                onLogSubmit={handleSubmit}
                expPreview={formExpPreview}
                studiedTopics={studiedTopics}
                onStudiedTopicsChange={setStudiedTopics}
                topicDifficulty={topicDifficulty}
                onTopicDifficultyChange={setTopicDifficulty}
                hasReportToday={hasReportToday}
                soundEnabled={soundEnabled}
              />
              <div className="space-y-5">
                <DailyQuests
                  quests={quests}
                  streak={streak}
                  loading={questsLoading}
                  reward={reward}
                  allDone={allDone}
                  updateProgress={updateProgress}
                  dismissReward={dismissReward}
                  soundEnabled={soundEnabled}
                  dueTopics={spacedRepetition.dueTopics}
                  reviewsLoading={spacedRepetition.loading}
                  onReview={handleChecklistReview}
                  onViewReviews={() => changeView("reviews")}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="focus" className="mt-0">
            <PomodoroTimer
              onOpenAIMentor={(prefill) => {
                setMentorPrefill(prefill)
                changeView("mentor")
              }}
            />
          </TabsContent>

          <TabsContent value="reviews" className="mt-0">
            <ReviewSchedule
              dueTopics={spacedRepetition.dueTopics}
              upcomingTopics={spacedRepetition.upcomingTopics}
              masteredTopics={spacedRepetition.masteredTopics}
              loading={spacedRepetition.loading}
              completedToday={reviewedToday}
              onCompleteReview={handleChecklistReview}
            />
          </TabsContent>

          <TabsContent value="mocks" className="mt-0">
            <MockQuestionBank />
          </TabsContent>

          <TabsContent value="mentor" className="mt-0">
            <AIMentor prefillPrompt={mentorPrefill} />
          </TabsContent>

          <TabsContent value="progress" className="mt-0 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <MockTestInput soundEnabled={soundEnabled} />
              <StreakTracker streak={streak} />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>Your preparation, at a glance</CardTitle>
                  <CardDescription>This week’s effort adds up.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {[
                      { label: "Lectures", value: weeklyStats.totalLectures },
                      {
                        label: "Topics revised",
                        value: weeklyStats.totalTopics,
                      },
                      {
                        label: "Practice hours",
                        value: weeklyStats.totalPractice,
                      },
                      {
                        label: "EXP earned",
                        value: weeklyStats.totalExp.toLocaleString(),
                      },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <p className="text-2xl font-semibold tabular-nums">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                        {currentRank.name}-Rank
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {currentRank.title} · {currentExp.toLocaleString()} EXP
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Weekly Study: <span className="font-medium text-foreground">{weeklyStudyStats.effectiveWeeklyHours.toFixed(1)} hrs</span>
                          {" "}(avg {weeklyStudyStats.dailyAvgHours}h/day)
                          {nextRank && (
                            <>
                              {" · "}
                              {rankProgress.isTimeGated ? (
                                <span className="text-amber-500 font-medium">
                                  ⏳ Need {rankProgress.hoursNeeded} more study hours this week for {nextRank.name}-Rank
                                </span>
                              ) : rankProgress.isExpGated ? (
                                <span className="text-primary font-medium">
                                  ⚡ Need {rankProgress.expNeeded.toLocaleString()} EXP for {nextRank.name}-Rank
                                </span>
                              ) : (
                                <span>
                                  Need {rankProgress.expNeeded.toLocaleString()} EXP & {nextRank.minWeeklyHours}h/wk study for {nextRank.name}-Rank
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {nextRank && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          Next: {nextRank.name}-Rank ({nextRank.minWeeklyHours}h/wk min)
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            {dailyReports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                  <h2 className="font-medium">
                    Your progress starts with one day
                  </h2>
                  <p className="mb-5 mt-2 text-sm text-muted-foreground">
                    Save your first study log to see your activity here.
                  </p>
                  <Button onClick={() => changeView("today")}>
                    Log your day
                    <ArrowRight />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily activity</CardTitle>
                      <CardDescription>
                        Lectures and topics · last 7 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={chartConfig}
                        className="h-[240px] w-full"
                      >
                        <BarChart
                          accessibilityLayer
                          data={getChartData(7)}
                          margin={{ left: -20, right: 8 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="lectures"
                            fill="var(--color-lectures)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="topics"
                            fill="var(--color-topics)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                      <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-1))]" />
                          Lectures
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-[hsl(var(--chart-2))]" />
                          Topics
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Experience over time</CardTitle>
                      <CardDescription>
                        Daily EXP · last 14 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={chartConfig}
                        className="h-[240px] w-full"
                      >
                        <RechartsLineChart
                          accessibilityLayer
                          data={getChartData(14)}
                          margin={{ left: -12, right: 8 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            minTickGap={28}
                            tickMargin={10}
                          />
                          <YAxis axisLine={false} tickLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="exp"
                            stroke="var(--color-exp)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </RechartsLineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
                <ActivityHeatmap dailyReports={dailyReports} weeks={5} />
              </>
            )}
          </TabsContent>
          <p className="mt-9 text-center text-xs text-muted-foreground/80">
            Show up. Stay curious. Keep going.
          </p>
        </div>
      </main>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make it yours</DialogTitle>
            <DialogDescription>
              Your exam, your pace, your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-3">
            <div className="space-y-2">
              <Label htmlFor="exam-date">Exam date</Label>
              <Input
                id="exam-date"
                type="date"
                value={examDate ? format(examDate, "yyyy-MM-dd") : ""}
                onChange={(event) =>
                  setExamDate(
                    event.target.value
                      ? new Date(`${event.target.value}T00:00:00`)
                      : null,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-mode">Appearance</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme-mode">
                  <SelectValue placeholder="Choose appearance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">Use device setting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Accent color</legend>
              <div className="grid grid-cols-3 gap-2">
                {themes.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="sm"
                    aria-pressed={selectedTheme === option.value}
                    onClick={() => {
                      setSelectedTheme(option.value)
                      sounds.buttonClick()
                    }}
                    className={
                      selectedTheme === option.value
                        ? "border-primary bg-primary/5"
                        : ""
                    }
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full mr-2"
                      style={{ backgroundColor: option.color }}
                    >
                      {selectedTheme === option.value && (
                        <Check className="!h-3 !w-3 text-white" />
                      )}
                    </span>
                    {option.name}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between border-t pt-5">
              <div>
                <Label htmlFor="sound">Sound effects</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  A little feedback for your progress.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!soundEnabled}
                  onClick={sounds.formSubmit}
                  className="h-8 text-xs"
                >
                  Test sound
                </Button>
                <Switch
                  id="sound"
                  checked={soundEnabled}
                  onCheckedChange={changeSound}
                />
              </div>
            </div>
            <ChangePasswordSettings />
            <Button
              variant="outline"
              className="w-full lg:hidden"
              onClick={async () => {
                const { error } = await createClient().auth.signOut()
                if (error) {
                  toast.error("Couldn’t sign out. Please try again.")
                  return
                }
                router.push("/signin")
                router.refresh()
              }}
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <SubmissionPopup
        isOpen={showSubmissionPopup}
        onClose={() => setShowSubmissionPopup(false)}
        expGained={lastExpGained}
        onLootClaimed={handleLootClaimed}
      />
      {upgradeModalData && (
        <RankUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          oldRank={upgradeModalData.oldRank}
          newRank={upgradeModalData.newRank}
          currentExp={upgradeModalData.currentExp}
          weeklyHours={upgradeModalData.weeklyHours}
        />
      )}
    </Tabs>
  )
}

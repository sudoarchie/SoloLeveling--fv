"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

interface RankInfo {
  name: string
  title: string
  color: string
  minExp: number
  maxExp: number
  description: string
}

const ranks: RankInfo[] = [
  {
    name: "E",
    title: "Novice",
    color: "hsl(var(--muted-foreground))",
    minExp: 0,
    maxExp: 500,
    description: "Just getting started",
  },
  {
    name: "D",
    title: "Learner",
    color: "hsl(var(--primary))",
    minExp: 500,
    maxExp: 1200,
    description: "Building foundations",
  },
  {
    name: "C",
    title: "Student",
    color: "hsl(var(--primary))",
    minExp: 1200,
    maxExp: 2000,
    description: "Making progress",
  },
  {
    name: "B",
    title: "Scholar",
    color: "hsl(var(--primary))",
    minExp: 2000,
    maxExp: 3000,
    description: "Solid understanding",
  },
  {
    name: "A",
    title: "Expert",
    color: "hsl(var(--primary))",
    minExp: 3000,
    maxExp: 4500,
    description: "Advanced knowledge",
  },
  {
    name: "S",
    title: "Master",
    color: "hsl(var(--primary))",
    minExp: 4500,
    maxExp: 6500,
    description: "Elite performance",
  },
  {
    name: "SS",
    title: "Elite",
    color: "hsl(var(--primary))",
    minExp: 6500,
    maxExp: 9000,
    description: "Top 5% performer",
  },
  {
    name: "SSS",
    title: "Legend",
    color: "hsl(var(--primary))",
    minExp: 9000,
    maxExp: 15000,
    description: "Legendary status",
  },
]

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
    if (userDataLoading || logInitialized.current) return
    logInitialized.current = true
    const today = dailyReports.find((report) =>
      isSameDay(report.date, new Date()),
    )
    if (today) {
      setFormData({
        lecturesCompleted: today.lecturesCompleted,
        topicsRevised: today.topicsRevised,
        practiceHours: today.practiceHours,
        morningSession: today.morningSession,
        exerciseDone: today.exerciseDone,
        distractionsLevel: today.distractionsLevel,
        mentalState: today.mentalState,
      })
    }
  }, [dailyReports, userDataLoading])

  // Get current rank
  const currentRank =
    ranks.find(
      (rank) => currentExp >= rank.minExp && currentExp < rank.maxExp,
    ) || ranks[ranks.length - 1]
  const nextRank =
    ranks[ranks.findIndex((r) => r.name === currentRank.name) + 1]

  // Calculate days remaining
  const daysRemaining = examDate
    ? Math.max(0, differenceInDays(examDate, new Date()))
    : 0

  // Calculate EXP progress within current rank
  const expProgress = Math.min(
    100,
    ((currentExp - currentRank.minExp) /
      (currentRank.maxExp - currentRank.minExp)) *
      100,
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

  // Calculate EXP gain
  const calculateExp = useCallback(
    (data: {
      lecturesCompleted: number
      topicsRevised: number
      practiceHours: number
      morningSession: boolean
      exerciseDone: boolean
      distractionsLevel: string
    }) => {
      let exp = 0
      exp += data.lecturesCompleted * 50
      exp += data.topicsRevised * 30
      exp += data.practiceHours * 100
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

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const expGained = calculateExp(formData)
      const newReport: DailyReport = {
        date: new Date(),
        ...formData,
        expGained,
      }

      const oldRank = currentRank
      const previousExp =
        dailyReports.find((report) => isSameDay(report.date, newReport.date))
          ?.expGained ?? 0
      await saveReport(newReport)
      await setCurrentExp((prev) => Math.max(0, prev + expGained - previousExp))

      // Feed studied topics into spaced repetition:
      // existing topics advance their review schedule, new ones enter the system
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

      // Include experience earned by the topic review schedule.
      if (topicFeedback.exp > 0)
        await setCurrentExp((prev) => prev + topicFeedback.exp)

      // Play sound effects
      if (soundEnabled) {
        sounds.formSubmit()
        if (expGained > 0) {
          setTimeout(() => sounds.expGain(), 200)
        }
      }

      // Show the submission popup with variable-reward loot roll
      setLastExpGained(expGained)
      setShowSubmissionPopup(true)

      // Check for rank up
      const newExp = currentExp + expGained - previousExp + topicFeedback.exp
      const newRank =
        ranks.find((rank) => newExp >= rank.minExp && newExp < rank.maxExp) ||
        ranks[ranks.length - 1]

      if (
        newRank.name !== oldRank.name &&
        ranks.findIndex((r) => r.name === newRank.name) >
          ranks.findIndex((r) => r.name === oldRank.name)
      ) {
        toast.success(`Rank up! You are now ${newRank.name}-Rank`, {
          description: newRank.description,
        })
        if (soundEnabled) {
          setTimeout(() => sounds.levelUp(), 500)
        }
      }

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

  // Apply claimed loot: bonus EXP + reward effects (titles, cosmetics, streak freezes)
  const handleLootClaimed = (loot: LootDrop) => {
    // Bonus EXP counts toward total
    setCurrentExp((prev) => prev + loot.bonusExp)
    if (soundEnabled) setTimeout(() => sounds.expGain(), 150)

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
        setCurrentExp((prev) => prev + exp)
        if (soundEnabled) setTimeout(() => sounds.expGain(), 150)
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
        practice: report?.practiceHours ?? 0,
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
      totalPractice: thisWeekReports.reduce(
        (sum, r) => sum + r.practiceHours,
        0,
      ),
      activeDays: thisWeekReports.length,
      avgExp:
        thisWeekReports.length > 0
          ? thisWeekReports.reduce((sum, r) => sum + r.expGained, 0) /
            thisWeekReports.length
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
  const hasReportToday = dailyReports.some((report) =>
    isSameDay(report.date, new Date()),
  )
  const viewCopy: Record<string, { title: string; description: string }> = {
    today: {
      title: "Make room for progress.",
      description: "One focused session at a time. Let’s make today count.",
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
      title: "Find your next practice paper.",
      description: "Choose an exam and explore questions, diagrams, and answers.",
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
            className="grid h-auto w-full grid-cols-5 gap-1 bg-transparent p-0 lg:flex lg:flex-col lg:items-stretch"
          >
            {[
              { value: "today", label: "Today", icon: LayoutDashboard },
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
                <p className="text-sm font-medium">{currentRank.title}</p>
                <p className="text-xs text-muted-foreground">
                  {currentExp.toLocaleString()} EXP
                </p>
              </div>
            </div>
            <Progress
              value={expProgress}
              aria-label="Progress to next rank"
              className="h-1.5"
            />
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              {nextRank
                ? `${(nextRank.minExp - currentExp).toLocaleString()} EXP to ${nextRank.title}`
                : "Highest rank reached"}
            </p>
            {activeTitle && (
              <p className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
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
                expPreview={calculateExp(formData)}
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
            <AIMentor />
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
                  <div className="mt-7 flex flex-wrap items-center gap-3 border-t pt-5">
                    <span className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                      {currentRank.name} rank
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {currentRank.title} · {currentExp.toLocaleString()} EXP
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nextRank
                          ? `${(nextRank.minExp - currentExp).toLocaleString()} EXP until ${nextRank.title}`
                          : "Highest rank reached"}
                      </p>
                    </div>
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
                    onClick={() => setSelectedTheme(option.value)}
                    className={
                      selectedTheme === option.value
                        ? "border-primary bg-primary/5"
                        : ""
                    }
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full"
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
              <Button
                variant="ghost"
                size="sm"
                disabled={!soundEnabled}
                onClick={sounds.formSubmit}
              >
                Test sound
              </Button>
              <Switch
                id="sound"
                checked={soundEnabled}
                onCheckedChange={changeSound}
              />
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
    </Tabs>
  )
}

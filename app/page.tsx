"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarIcon,
  Zap,
  Target,
  Brain,
  Dumbbell,
  Clock,
  TrendingUp,
  Flame,
  Volume2,
  VolumeX,
  Crown,
  Star,
  Sword,
  BarChart3,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { useSoundEffects } from "../hooks/useSoundEffects"
import SubmissionPopup from "../components/SubmissionPopup"
import TargetSettings from "../components/TargetSettings"
import ProgressCharts from "../components/ProgressCharts"
import ExamDateSettings from "../components/ExamDateSettings"

interface DailyReport {
  date: Date
  lecturesCompleted: number
  postLectureRevision: boolean
  oldTopicsRevised: number
  questionPracticeHours: number
  morningSession: boolean
  exerciseDone: boolean
  goalVisualization: boolean
  distractionsLevel: string
  missedLecture: boolean
  noRevision: boolean
  noQuestionPractice: boolean
  oversleeping: boolean
  mentalState: string
  finalComment: string
  expGained: number
}

interface DailyTargets {
  lecturesCompleted: number
  oldTopicsRevised: number
  questionPracticeHours: number
}

interface RankInfo {
  name: string
  fullName: string
  color: string
  glowColor: string
  minExp: number
  maxExp: number
  meaning: string
  gateInterpretation: string
  mentalState: string
  icon: React.ComponentType<any>
}

const ranks: RankInfo[] = [
  {
    name: "E",
    fullName: "E-Rank Hunter",
    color: "#8B4513",
    glowColor: "#D2691E",
    minExp: 0,
    maxExp: 400,
    meaning: "Barely awakened hunter",
    gateInterpretation: "Just started prep, no discipline, confused",
    mentalState: "Clueless but curious",
    icon: Target,
  },
  {
    name: "D",
    fullName: "D-Rank Hunter",
    color: "#708090",
    glowColor: "#C0C0C0",
    minExp: 400,
    maxExp: 1000,
    meaning: "Weak but aware of the battlefield",
    gateInterpretation: "Knows subjects, lacks retention, low output",
    mentalState: "Lazy → scattered energy",
    icon: Sword,
  },
  {
    name: "C",
    fullName: "C-Rank Hunter",
    color: "#228B22",
    glowColor: "#32CD32",
    minExp: 1000,
    maxExp: 1800,
    meaning: "Beginner hunter, can survive solo",
    gateInterpretation: "Some consistency, can solve basics, but unstable",
    mentalState: "Learning to focus",
    icon: Brain,
  },
  {
    name: "B",
    fullName: "B-Rank Hunter",
    color: "#4169E1",
    glowColor: "#00BFFF",
    minExp: 1800,
    maxExp: 2800,
    meaning: "Semi-professional hunter",
    gateInterpretation: "Good understanding, improving speed & accuracy",
    mentalState: "Showing discipline",
    icon: Zap,
  },
  {
    name: "A",
    fullName: "A-Rank Hunter",
    color: "#9932CC",
    glowColor: "#DA70D6",
    minExp: 2800,
    maxExp: 4000,
    meaning: "National-level hunter",
    gateInterpretation: "Solves most questions, strong revision habits",
    mentalState: "Focused, confident",
    icon: Star,
  },
  {
    name: "S",
    fullName: "S-Rank Hunter",
    color: "#FFD700",
    glowColor: "#FFF700",
    minExp: 4000,
    maxExp: 5500,
    meaning: "Elite-tier hunter",
    gateInterpretation: "Top 2-5% GATE ranker level — full command on topics",
    mentalState: "Ruthless execution",
    icon: Crown,
  },
  {
    name: "SS",
    fullName: "SS-Rank Hunter",
    color: "#FF6347",
    glowColor: "#FF4500",
    minExp: 5500,
    maxExp: 7000,
    meaning: "Near mythical hunter",
    gateInterpretation: "80+ marks consistently, time-managed, strategic",
    mentalState: "Tactical, elite mindset",
    icon: Crown,
  },
  {
    name: "SSS",
    fullName: "SSS-Rank Hunter",
    color: "#FF1493",
    glowColor: "#FF69B4",
    minExp: 7000,
    maxExp: 10000,
    meaning: "Monarch-level, top 0.1%",
    gateInterpretation: "AIR 1–50 level, laser focused, near-perfection",
    mentalState: "Unshakable inner state",
    icon: Crown,
  },
]

const motivationalQuotes = [
  "The weak fear the shadows. The strong become them.",
  "Every question solved is a step closer to your throne.",
  "Monarchs aren't born. They're forged through discipline.",
  "Your rank reflects your dedication. What does yours say?",
  "The GATE doesn't care about your excuses.",
  "Rise from E-Rank to legend. The choice is yours.",
  "In the dungeon of preparation, only the disciplined survive.",
  "Your future self is watching. Make them proud.",
  "Weakness is a choice. Strength is a commitment.",
  "The grind separates hunters from legends.",
  "Every dawn is a chance to level up your destiny.",
  "The battlefield of GATE awaits. Are you ready?",
]

const LOCAL_STORAGE_KEY = "gateTrackerData"

export default function GATETracker() {
  const [currentExp, setCurrentExp] = useState(0)
  const [currentRank, setCurrentRank] = useState(ranks[0])
  const [previousRank, setPreviousRank] = useState(ranks[0])
  const [examDate, setExamDate] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([])
  const [currentQuote, setCurrentQuote] = useState("")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false)
  const [showSubmissionPopup, setShowSubmissionPopup] = useState(false)
  const [dailyTargets, setDailyTargets] = useState<DailyTargets>({
    lecturesCompleted: 3,
    oldTopicsRevised: 5,
    questionPracticeHours: 2,
  })
  const [lastSubmissionData, setLastSubmissionData] = useState<{
    expGained: number
    averageExpPerDay: number
    daysToNextRank: number | null
  } | null>(null)

  const sounds = useSoundEffects()

  const [formData, setFormData] = useState({
    lecturesCompleted: 0,
    postLectureRevision: false,
    oldTopicsRevised: 0,
    questionPracticeHours: 0,
    morningSession: false,
    exerciseDone: false,
    goalVisualization: false,
    distractionsLevel: "None",
    missedLecture: false,
    noRevision: false,
    noQuestionPractice: false,
    oversleeping: false,
    mentalState: "",
    finalComment: "",
  })

  // Calculate days remaining
  const calculateDaysRemaining = useCallback(() => {
    if (!examDate) return 170 // Default fallback
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const exam = new Date(examDate)
    exam.setHours(0, 0, 0, 0)
    return Math.max(0, differenceInDays(exam, today))
  }, [examDate])

  const daysRemaining = calculateDaysRemaining()

  // Load data from local storage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setCurrentExp(parsedData.currentExp || 0)
        setDailyReports(
          parsedData.dailyReports
            ? parsedData.dailyReports.map((report: DailyReport) => ({
                ...report,
                date: new Date(report.date),
              }))
            : [],
        )
        setSoundEnabled(parsedData.soundEnabled ?? true)
        if (parsedData.examDate) {
          setExamDate(new Date(parsedData.examDate))
        }
        setDailyTargets(
          parsedData.dailyTargets || {
            lecturesCompleted: 3,
            oldTopicsRevised: 5,
            questionPracticeHours: 2,
          },
        )
      }
    } catch (error) {
      console.error("Failed to load data from local storage:", error)
    }
  }, [])

  // Save data to local storage whenever relevant state changes
  useEffect(() => {
    try {
      const dataToSave = {
        currentExp,
        dailyReports: dailyReports.map((report) => ({
          ...report,
          date: report.date.toISOString(),
        })),
        soundEnabled,
        examDate: examDate?.toISOString(),
        dailyTargets,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error("Failed to save data to local storage:", error)
    }
  }, [currentExp, dailyReports, soundEnabled, examDate, dailyTargets])

  // Initialize quote
  useEffect(() => {
    setCurrentQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)])
  }, [])

  // Update rank based on EXP and check for level up
  useEffect(() => {
    const newRank =
      ranks.find((rank) => currentExp >= rank.minExp && currentExp < rank.maxExp) || ranks[ranks.length - 1]

    if (newRank.name !== currentRank.name) {
      setPreviousRank(currentRank)
      setCurrentRank(newRank)

      const currentRankIndex = ranks.findIndex((r) => r.name === currentRank.name)
      const newRankIndex = ranks.findIndex((r) => r.name === newRank.name)

      if (newRankIndex > currentRankIndex) {
        if (soundEnabled) {
          sounds.levelUp()
        }
        setShowLevelUpAnimation(true)
        setTimeout(() => setShowLevelUpAnimation(false), 4000)
      }
    }
  }, [currentExp, currentRank, soundEnabled, sounds])

  const calculateExpGain = useCallback((report: Omit<DailyReport, "date" | "expGained">) => {
    let exp = 0

    exp += report.lecturesCompleted * 100
    exp += report.postLectureRevision ? 150 : 0
    exp += report.oldTopicsRevised >= 5 ? 200 : 0
    exp += report.questionPracticeHours >= 1 ? 150 : 0
    exp += report.morningSession ? 100 : 0
    exp += report.exerciseDone ? 100 : 0
    exp += report.goalVisualization ? 50 : 0
    exp += report.distractionsLevel === "None" ? 150 : 0

    exp -= report.missedLecture ? 100 : 0
    exp -= report.noRevision ? 150 : 0
    exp -= report.noQuestionPractice ? 150 : 0
    exp -= report.oversleeping ? 100 : 0

    const distractionPenalty = {
      None: 0,
      Low: -50,
      Medium: -100,
      High: -200,
    }
    exp += distractionPenalty[report.distractionsLevel as keyof typeof distractionPenalty] || 0

    return exp
  }, [])

  const calculateAverageExpPerDay = useCallback(() => {
    if (dailyReports.length === 0) return 0
    const totalExp = dailyReports.reduce((sum, report) => sum + report.expGained, 0)
    return totalExp / dailyReports.length
  }, [dailyReports])

  const calculateDaysToNextRank = useCallback(
    (avgExpPerDay: number) => {
      const nextRank = getNextRank()
      if (!nextRank || avgExpPerDay <= 0) return null

      const expNeeded = nextRank.minExp - currentExp
      if (expNeeded <= 0) return 0

      return expNeeded / avgExpPerDay
    },
    [currentExp],
  )

  const getProgressData = useCallback(() => {
    console.log("Getting progress data, dailyReports length:", dailyReports.length)
    const data = dailyReports
      .slice(0, 7)
      .reverse()
      .map((report) => ({
        date: format(report.date, "MM/dd"),
        lectures: report.lecturesCompleted,
        topics: report.oldTopicsRevised,
        hours: report.questionPracticeHours,
        lecturesTarget: dailyTargets.lecturesCompleted,
        topicsTarget: dailyTargets.oldTopicsRevised,
        hoursTarget: dailyTargets.questionPracticeHours,
        expGained: report.expGained,
      }))
    console.log("Progress data:", data)
    return data
  }, [dailyReports, dailyTargets])

  const getTargetProgress = useCallback((actual: number, target: number) => {
    if (target === 0) return "text-green-400"
    const percentage = (actual / target) * 100
    if (percentage >= 100) return "text-green-400"
    if (percentage >= 50) return "text-yellow-400"
    return "text-red-400"
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const expGained = calculateExpGain(formData)
    const newReport: DailyReport = {
      date: selectedDate,
      ...formData,
      expGained,
    }

    console.log("Submitting new report:", newReport)

    setCurrentExp((prev) => Math.max(0, prev + expGained))
    setDailyReports((prev) => {
      const updated = [newReport, ...prev.slice(0, 29)]
      console.log("Updated daily reports:", updated)
      return updated
    })

    const updatedReportsForAvg = [newReport, ...dailyReports.slice(0, 29)]
    const totalExpForAvg = updatedReportsForAvg.reduce((sum, report) => sum + report.expGained, 0)
    const averageExpPerDayCalculated =
      updatedReportsForAvg.length > 0 ? totalExpForAvg / updatedReportsForAvg.length : 0
    const daysToNextRankCalculated = calculateDaysToNextRank(averageExpPerDayCalculated)

    setLastSubmissionData({
      expGained,
      averageExpPerDay: averageExpPerDayCalculated,
      daysToNextRank: daysToNextRankCalculated,
    })

    if (soundEnabled) {
      sounds.formSubmit()
      setTimeout(() => {
        if (expGained > 0) {
          sounds.expGain()
        }
        sounds.notification()
      }, 400)
    }

    setShowSubmissionPopup(true)

    setFormData({
      lecturesCompleted: 0,
      postLectureRevision: false,
      oldTopicsRevised: 0,
      questionPracticeHours: 0,
      morningSession: false,
      exerciseDone: false,
      goalVisualization: false,
      distractionsLevel: "None",
      missedLecture: false,
      noRevision: false,
      noQuestionPractice: false,
      oversleeping: false,
      mentalState: "",
      finalComment: "",
    })

    setCurrentQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)])
  }

  const handleButtonClick = () => {
    if (soundEnabled) {
      sounds.buttonClick()
    }
  }

  const handleToggleSwitch = () => {
    if (soundEnabled) {
      sounds.toggleSwitch()
    }
  }

  const getExpProgress = () => {
    const progress = ((currentExp - currentRank.minExp) / (currentRank.maxExp - currentRank.minExp)) * 100
    return Math.min(100, Math.max(0, progress))
  }

  const getNextRank = useCallback(() => {
    const currentIndex = ranks.findIndex((rank) => rank.name === currentRank.name)
    return currentIndex < ranks.length - 1 ? ranks[currentIndex + 1] : null
  }, [currentRank])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      {lastSubmissionData && (
        <SubmissionPopup
          isOpen={showSubmissionPopup}
          onClose={() => setShowSubmissionPopup(false)}
          currentRank={currentRank}
          currentExp={currentExp}
          expGained={lastSubmissionData.expGained}
          daysRemaining={daysRemaining}
          averageExpPerDay={lastSubmissionData.averageExpPerDay}
          daysToNextRank={lastSubmissionData.daysToNextRank}
          nextRank={getNextRank()}
        />
      )}

      {showLevelUpAnimation && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div className="text-8xl font-bold text-yellow-400 mb-4 animate-pulse glow-text">RANK UP!</div>
            <div className="text-4xl font-bold text-white mb-2">
              {previousRank.name}-Rank → {currentRank.name}-Rank
            </div>
            <div className="text-2xl text-cyan-400 mb-4">{currentRank.fullName}</div>
            <div className="text-lg text-gray-300 mb-2">{currentRank.meaning}</div>
            <div className="text-md text-purple-400 italic mb-6">"{currentRank.mentalState}"</div>
            <div className="mt-8">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold border-8 mx-auto animate-spin-slow relative"
                style={{
                  backgroundColor: currentRank.color,
                  borderColor: currentRank.glowColor,
                  boxShadow: `0 0 50px ${currentRank.glowColor}`,
                }}
              >
                {currentRank.name}
                <div
                  className="absolute inset-0 rounded-full animate-ping border-4"
                  style={{ borderColor: currentRank.glowColor }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="text-center mb-12">
          <div className="flex justify-between items-start mb-4">
            <div></div>
            <div className="relative inline-block">
              <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-4 tracking-wider">
                GATE
              </h1>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-lg blur opacity-20 animate-pulse"></div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSoundEnabled(!soundEnabled)
                if (!soundEnabled) sounds.buttonClick()
              }}
              className="text-gray-400 hover:text-white"
            >
              {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </Button>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-300 mb-2 tracking-wide">SOLO LEVELING SYSTEM</h2>
          <div className="flex items-center justify-center space-x-4 text-lg">
            <Clock className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-mono font-bold">{daysRemaining} Days to GATE</span>
          </div>
          <p className="text-gray-400 mt-2 text-lg font-medium">Rank Up Daily. No Mercy.</p>
        </header>

        <Tabs defaultValue="tracker" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 border-gray-700">
            <TabsTrigger value="tracker" className="data-[state=active]:bg-cyan-600">
              <Target className="w-4 h-4 mr-2" />
              Hunter Tracker
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-cyan-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Progress Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracker" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-700">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-2xl font-bold text-cyan-400 flex items-center">
                        <Target className="w-6 h-6 mr-2" />
                        Daily Hunter Report
                      </CardTitle>
                      <TargetSettings
                        targets={dailyTargets}
                        onTargetsChange={setDailyTargets}
                        onSoundClick={handleButtonClick}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-gray-300 font-medium">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-gray-800 border-gray-600 hover:bg-gray-700"
                              onClick={handleButtonClick}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                if (date) {
                                  setSelectedDate(date)
                                  handleButtonClick()
                                }
                              }}
                              initialFocus
                              className="bg-gray-800"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
                          <Zap className="w-5 h-5 mr-2" />
                          EXP Gaining Activities
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label className="text-gray-300 font-medium">
                              Lectures Completed (+100 each) - Target: {dailyTargets.lecturesCompleted}
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              value={formData.lecturesCompleted}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  lecturesCompleted: Number.parseInt(e.target.value) || 0,
                                }))
                              }
                              onFocus={handleButtonClick}
                              className="bg-gray-800 border-gray-600 focus:border-green-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-300 font-medium">
                              Old Topics Revised (5+ for +200) - Target: {dailyTargets.oldTopicsRevised}
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="20"
                              value={formData.oldTopicsRevised}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  oldTopicsRevised: Number.parseInt(e.target.value) || 0,
                                }))
                              }
                              onFocus={handleButtonClick}
                              className="bg-gray-800 border-gray-600 focus:border-green-400"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <Label className="text-gray-300 font-medium">
                            Question Practice Hours (1+ for +150) - Target: {dailyTargets.questionPracticeHours}h
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="12"
                            step="0.5"
                            value={formData.questionPracticeHours}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                questionPracticeHours: Number.parseFloat(e.target.value) || 0,
                              }))
                            }
                            onFocus={handleButtonClick}
                            className="bg-gray-800 border-gray-600 focus:border-green-400"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-2">
                              <Brain className="w-4 h-4 text-green-400" />
                              <Label className="text-gray-300 text-sm">Post-Lecture Revision (+150)</Label>
                            </div>
                            <Switch
                              checked={formData.postLectureRevision}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, postLectureRevision: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-green-400" />
                              <Label className="text-gray-300 text-sm">Morning Session (+100)</Label>
                            </div>
                            <Switch
                              checked={formData.morningSession}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, morningSession: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-2">
                              <Dumbbell className="w-4 h-4 text-green-400" />
                              <Label className="text-gray-300 text-sm">Exercise Done (+100)</Label>
                            </div>
                            <Switch
                              checked={formData.exerciseDone}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, exerciseDone: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-2">
                              <Target className="w-4 h-4 text-green-400" />
                              <Label className="text-gray-300 text-sm">Goal Visualization (+50)</Label>
                            </div>
                            <Switch
                              checked={formData.goalVisualization}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, goalVisualization: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300 font-medium">Distractions Level</Label>
                        <Select
                          value={formData.distractionsLevel}
                          onValueChange={(value) => {
                            setFormData((prev) => ({ ...prev, distractionsLevel: value }))
                            handleButtonClick()
                          }}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600">
                            <SelectValue placeholder="Select distraction level" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="None" className="text-green-400">
                              None (+150)
                            </SelectItem>
                            <SelectItem value="Low" className="text-yellow-400">
                              Low (-50)
                            </SelectItem>
                            <SelectItem value="Medium" className="text-orange-400">
                              Medium (-100)
                            </SelectItem>
                            <SelectItem value="High" className="text-red-400">
                              High (-200)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
                          <Flame className="w-5 h-5 mr-2" />
                          EXP Penalties
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <Label className="text-gray-300 text-sm">Missed Lecture (-100)</Label>
                            <Switch
                              checked={formData.missedLecture}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, missedLecture: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <Label className="text-gray-300 text-sm">No Revision (-150)</Label>
                            <Switch
                              checked={formData.noRevision}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, noRevision: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <Label className="text-gray-300 text-sm">No Question Practice (-150)</Label>
                            <Switch
                              checked={formData.noQuestionPractice}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, noQuestionPractice: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <Label className="text-gray-300 text-sm">Oversleeping (-100)</Label>
                            <Switch
                              checked={formData.oversleeping}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({ ...prev, oversleeping: checked }))
                                handleToggleSwitch()
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300 font-medium">Mental State</Label>
                        <Input
                          value={formData.mentalState}
                          onChange={(e) => setFormData((prev) => ({ ...prev, mentalState: e.target.value }))}
                          onFocus={handleButtonClick}
                          placeholder="How are you feeling today?"
                          className="bg-gray-800 border-gray-600 focus:border-cyan-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300 font-medium">Final Comment</Label>
                        <Textarea
                          value={formData.finalComment}
                          onChange={(e) => setFormData((prev) => ({ ...prev, finalComment: e.target.value }))}
                          onFocus={handleButtonClick}
                          placeholder="Any additional thoughts or reflections..."
                          className="bg-gray-800 border-gray-600 focus:border-cyan-400 min-h-[100px]"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 text-lg"
                        onClick={handleButtonClick}
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        Submit Hunter Report
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-700">
                    <CardTitle className="text-xl font-bold text-cyan-400 flex items-center justify-between">
                      <div className="flex items-center">
                        <Crown className="w-5 h-5 mr-2" />
                        Hunter Status
                      </div>
                      <ExamDateSettings
                        examDate={examDate}
                        onExamDateChange={setExamDate}
                        onSoundClick={handleButtonClick}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4 mx-auto mb-4 relative"
                        style={{
                          backgroundColor: currentRank.color,
                          borderColor: currentRank.glowColor,
                          boxShadow: `0 0 20px ${currentRank.glowColor}40`,
                        }}
                      >
                        {currentRank.name}
                        <div
                          className="absolute inset-0 rounded-full animate-pulse border-2"
                          style={{ borderColor: currentRank.glowColor }}
                        ></div>
                      </div>
                      <Badge
                        className="text-white font-bold mb-2"
                        style={{
                          backgroundColor: currentRank.color,
                          boxShadow: `0 0 10px ${currentRank.glowColor}40`,
                        }}
                      >
                        {currentRank.fullName}
                      </Badge>
                      <p className="text-gray-400 text-sm mb-2">{currentRank.meaning}</p>
                      <p className="text-purple-400 italic text-sm">"{currentRank.mentalState}"</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-300 text-sm">EXP Progress</span>
                          <span className="text-cyan-400 font-mono text-sm">
                            {currentExp.toLocaleString()} / {currentRank.maxExp.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={getExpProgress()} className="h-3 bg-gray-700" />
                      </div>

                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">GATE Interpretation</h4>
                        <p className="text-xs text-gray-400">{currentRank.gateInterpretation}</p>
                      </div>

                      {getNextRank() && (
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">Next Rank Goal</h4>
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
                              style={{
                                backgroundColor: getNextRank()!.color,
                                borderColor: getNextRank()!.glowColor,
                                boxShadow: `0 0 10px ${getNextRank()!.glowColor}40`,
                              }}
                            >
                              {getNextRank()!.name}
                            </div>
                            <div>
                              <p className="text-gray-200 text-sm font-medium">{getNextRank()!.fullName}</p>
                              <p className="text-xs text-gray-400">
                                {(getNextRank()!.minExp - currentExp).toLocaleString()} EXP needed
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-300 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
                      Activity Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {dailyReports.length > 0 ? (
                      <div className="space-y-4">
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-300 mb-3">Last 7 Days Average</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Lectures/Day:</span>
                              <span
                                className={`font-mono text-sm ${getTargetProgress(
                                  dailyReports.slice(0, 7).reduce((sum, report) => sum + report.lecturesCompleted, 0) /
                                    Math.min(7, dailyReports.length),
                                  dailyTargets.lecturesCompleted,
                                )}`}
                              >
                                {(
                                  dailyReports.slice(0, 7).reduce((sum, report) => sum + report.lecturesCompleted, 0) /
                                  Math.min(7, dailyReports.length)
                                ).toFixed(1)}
                                /{dailyTargets.lecturesCompleted}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Topics/Day:</span>
                              <span
                                className={`font-mono text-sm ${getTargetProgress(
                                  dailyReports.slice(0, 7).reduce((sum, report) => sum + report.oldTopicsRevised, 0) /
                                    Math.min(7, dailyReports.length),
                                  dailyTargets.oldTopicsRevised,
                                )}`}
                              >
                                {(
                                  dailyReports.slice(0, 7).reduce((sum, report) => sum + report.oldTopicsRevised, 0) /
                                  Math.min(7, dailyReports.length)
                                ).toFixed(1)}
                                /{dailyTargets.oldTopicsRevised}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Hours/Day:</span>
                              <span
                                className={`font-mono text-sm ${getTargetProgress(
                                  dailyReports
                                    .slice(0, 7)
                                    .reduce((sum, report) => sum + report.questionPracticeHours, 0) /
                                    Math.min(7, dailyReports.length),
                                  dailyTargets.questionPracticeHours,
                                )}`}
                              >
                                {(
                                  dailyReports
                                    .slice(0, 7)
                                    .reduce((sum, report) => sum + report.questionPracticeHours, 0) /
                                  Math.min(7, dailyReports.length)
                                ).toFixed(1)}
                                h/{dailyTargets.questionPracticeHours}h
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Avg EXP/Day:</span>
                              <span className="text-yellow-400 font-mono text-sm">
                                {calculateAverageExpPerDay().toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent Reports</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {dailyReports.slice(0, 5).map((report, index) => (
                              <div key={index} className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">{format(report.date, "MM/dd")}</span>
                                <span
                                  className={`font-mono ${report.expGained >= 0 ? "text-green-400" : "text-red-400"}`}
                                >
                                  {report.expGained >= 0 ? "+" : ""}
                                  {report.expGained}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <p>Submit your first report to see activity summary!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-300">Hunter's Wisdom</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <blockquote className="text-center italic text-gray-400 border-l-4 border-cyan-400 pl-4">
                      "{currentQuote}"
                    </blockquote>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <ProgressCharts data={getProgressData()} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

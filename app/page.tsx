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
} from "lucide-react"
import { format } from "date-fns"
import { useSoundEffects } from "../hooks/useSoundEffects"
import { SubmissionPopup } from "../components/SubmissionPopup"

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
  const [daysRemaining, setDaysRemaining] = useState(170)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([])
  const [currentQuote, setCurrentQuote] = useState("")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false)
  const [showSubmissionPopup, setShowSubmissionPopup] = useState(false)
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
                date: new Date(report.date), // Re-parse date strings to Date objects
              }))
            : [],
        )
        setSoundEnabled(parsedData.soundEnabled ?? true)
        setDaysRemaining(parsedData.daysRemaining || 170)
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
          date: report.date.toISOString(), // Convert Date objects to ISO strings
        })),
        soundEnabled,
        daysRemaining,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error("Failed to save data to local storage:", error)
    }
  }, [currentExp, dailyReports, soundEnabled, daysRemaining])

  // Initialize quote and countdown
  useEffect(() => {
    setCurrentQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)])

    const interval = setInterval(() => {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + daysRemaining)
      const now = new Date()
      const difference = targetDate.getTime() - now.getTime()
      const days = Math.ceil(difference / (1000 * 3600 * 24))
      setDaysRemaining(Math.max(0, days))
    }, 86400000) // Update daily

    return () => clearInterval(interval)
  }, [daysRemaining])

  // Update rank based on EXP and check for level up
  useEffect(() => {
    const newRank =
      ranks.find((rank) => currentExp >= rank.minExp && currentExp < rank.maxExp) || ranks[ranks.length - 1]

    if (newRank.name !== currentRank.name) {
      setPreviousRank(currentRank)
      setCurrentRank(newRank)

      // Check if it's a rank up (not down)
      const currentRankIndex = ranks.findIndex((r) => r.name === currentRank.name)
      const newRankIndex = ranks.findIndex((r) => r.name === newRank.name)

      if (newRankIndex > currentRankIndex) {
        // Level up!
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

    // Positive EXP
    exp += report.lecturesCompleted * 100 // 100 EXP per lecture
    exp += report.postLectureRevision ? 150 : 0 // 150 EXP for post-lecture revision
    exp += report.oldTopicsRevised >= 5 ? 200 : 0 // 200 EXP for 5+ old topics
    exp += report.questionPracticeHours >= 1 ? 150 : 0 // 150 EXP for 1+ hour practice
    exp += report.morningSession ? 100 : 0 // 100 EXP for morning session
    exp += report.exerciseDone ? 100 : 0 // 100 EXP for exercise
    exp += report.goalVisualization ? 50 : 0 // 50 EXP for goal visualization
    exp += report.distractionsLevel === "None" ? 150 : 0 // 150 EXP for zero distractions

    // Negative EXP (Penalties)
    exp -= report.missedLecture ? 100 : 0 // -100 EXP for missed lecture
    exp -= report.noRevision ? 150 : 0 // -150 EXP for no revision
    exp -= report.noQuestionPractice ? 150 : 0 // -150 EXP for no question practice
    exp -= report.oversleeping ? 100 : 0 // -100 EXP for oversleeping

    // Additional distraction penalties
    const distractionPenalty = {
      None: 0,
      Low: -50,
      Medium: -100,
      High: -200,
    }
    exp += distractionPenalty[report.distractionsLevel as keyof typeof distractionPenalty] || 0

    return exp // Allow negative EXP
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
      if (expNeeded <= 0) return 0 // Already reached or surpassed next rank

      return expNeeded / avgExpPerDay
    },
    [currentExp, dailyReports],
  ) // Added dailyReports to dependencies

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const expGained = calculateExpGain(formData)
    const newReport: DailyReport = {
      date: selectedDate,
      ...formData,
      expGained,
    }

    setCurrentExp((prev) => Math.max(0, prev + expGained))
    setDailyReports((prev) => [newReport, ...prev.slice(0, 29)]) // Keep last 30 days for average

    // Calculate statistics for popup
    // Use the *new* list of daily reports for calculations immediately after update
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

    // Play sounds
    if (soundEnabled) {
      sounds.formSubmit()
      setTimeout(() => {
        if (expGained > 0) {
          sounds.expGain()
        }
        sounds.notification()
      }, 400)
    }

    // Show submission popup
    setShowSubmissionPopup(true)

    // Reset form
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

    // New motivational quote
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

  const getRankColor = (rankName: string) => {
    const rank = ranks.find((r) => r.name === rankName)
    return rank ? rank.color : "#8B4513"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      {/* Submission Popup */}
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

      {/* Level Up Animation */}
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

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Daily Report Form */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-700">
                <CardTitle className="text-2xl font-bold text-cyan-400 flex items-center">
                  <Target className="w-6 h-6 mr-2" />
                  Daily Hunter Report
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Date Picker */}
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

                  {/* Positive Activities */}
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
                      <Zap className="w-5 h-5 mr-2" />
                      EXP Gaining Activities
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300 font-medium">Lectures Completed (+100 each)</Label>
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
                        <Label className="text-gray-300 font-medium">Old Topics Revised (5+ for +200)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          value={formData.oldTopicsRevised}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, oldTopicsRevised: Number.parseInt(e.target.value) || 0 }))
                          }
                          onFocus={handleButtonClick}
                          className="bg-gray-800 border-gray-600 focus:border-green-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <Label className="text-gray-300 font-medium">Question Practice Hours (1+ for +150)</Label>
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

                    {/* Toggle Switches */}
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

                  {/* Distractions Level */}
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
                        <SelectItem value="None">None (+150 EXP)</SelectItem>
                        <SelectItem value="Low">Low (-50 EXP)</SelectItem>
                        <SelectItem value="Medium">Medium (-100 EXP)</SelectItem>
                        <SelectItem value="High">High (-200 EXP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Negative Activities */}
                  <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
                      <Flame className="w-5 h-5 mr-2" />
                      EXP Penalties (Check if applicable)
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

                  {/* Text Areas */}
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-medium">Mental State</Label>
                    <Textarea
                      value={formData.mentalState}
                      onChange={(e) => setFormData((prev) => ({ ...prev, mentalState: e.target.value }))}
                      onFocus={handleButtonClick}
                      className="bg-gray-800 border-gray-600 focus:border-cyan-400 min-h-[80px]"
                      placeholder="How are you feeling today? Any challenges or victories?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300 font-medium">Final Comment</Label>
                    <Textarea
                      value={formData.finalComment}
                      onChange={(e) => setFormData((prev) => ({ ...prev, finalComment: e.target.value }))}
                      onFocus={handleButtonClick}
                      className="bg-gray-800 border-gray-600 focus:border-cyan-400 min-h-[80px]"
                      placeholder="Any additional thoughts or plans for tomorrow?"
                    />
                  </div>

                  {/* EXP Preview */}
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-medium">Estimated EXP Gain/Loss:</span>
                      <span
                        className={`text-xl font-bold ${calculateExpGain(formData) >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {calculateExpGain(formData) >= 0 ? "+" : ""}
                        {calculateExpGain(formData)} EXP
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Submit Hunter Report
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Progress Panel */}
          <div className="space-y-6">
            {/* Current Rank */}
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold text-gray-300">Hunter Status</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="relative inline-block mb-4">
                  <div
                    className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold border-4 relative"
                    style={{
                      backgroundColor: currentRank.color,
                      borderColor: currentRank.glowColor,
                      boxShadow: `0 0 25px ${currentRank.glowColor}60`,
                    }}
                  >
                    {currentRank.name}
                  </div>
                  <div
                    className="absolute -inset-3 rounded-full animate-pulse"
                    style={{ backgroundColor: `${currentRank.glowColor}15` }}
                  ></div>
                </div>
                <p className="text-gray-400 mb-2 text-lg font-semibold">{currentRank.fullName}</p>
                <p className="text-sm text-gray-500 mb-2 italic">"{currentRank.mentalState}"</p>
                <p className="text-xs text-gray-600 mb-4">{currentRank.gateInterpretation}</p>

                {/* EXP Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">EXP</span>
                    <span className="text-cyan-400">
                      {currentExp.toLocaleString()} / {currentRank.maxExp.toLocaleString()}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={getExpProgress()} className="h-3 bg-gray-700" />
                    <div
                      className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                      style={{ width: `${getExpProgress()}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {getNextRank()
                      ? `${(currentRank.maxExp - currentExp).toLocaleString()} EXP to ${getNextRank()?.name}-Rank`
                      : "Maximum Rank Achieved!"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Rank Progression */}
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-300">Rank Progression</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ranks.map((rank, index) => {
                    const isCurrentRank = rank.name === currentRank.name
                    const isAchieved = currentExp >= rank.minExp
                    const IconComponent = rank.icon

                    return (
                      <div
                        key={rank.name}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          isCurrentRank
                            ? "bg-cyan-900/30 border-cyan-500/50"
                            : isAchieved
                              ? "bg-gray-800/50 border-gray-600"
                              : "bg-gray-800/20 border-gray-700/30"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                              isAchieved ? "opacity-100" : "opacity-40"
                            }`}
                            style={{
                              backgroundColor: isAchieved ? rank.color : "transparent",
                              borderColor: rank.glowColor,
                              boxShadow: isCurrentRank ? `0 0 10px ${rank.glowColor}40` : "none",
                            }}
                          >
                            {rank.name}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isAchieved ? "text-gray-200" : "text-gray-500"}`}>
                              {rank.fullName}
                            </p>
                            <p className="text-xs text-gray-600">{rank.minExp.toLocaleString()} EXP</p>
                          </div>
                        </div>
                        <IconComponent className={`w-4 h-4 ${isAchieved ? "text-cyan-400" : "text-gray-600"}`} />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Days Remaining */}
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 text-red-400 mr-2" />
                  <span className="text-lg font-semibold text-gray-300">Days Remaining</span>
                </div>
                <div className="text-4xl font-bold text-red-400 mb-2">{daysRemaining}</div>
                <p className="text-gray-500 text-sm">Until GATE Exam</p>
              </CardContent>
            </Card>

            {/* Motivational Quote */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <Flame className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                <blockquote className="text-lg font-medium text-gray-200 italic">"{currentQuote}"</blockquote>
              </CardContent>
            </Card>

            {/* Last 7 Days Summary */}
            {dailyReports.length > 0 && (
              <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-300 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dailyReports.slice(0, 7).map((report, index) => {
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-300">{format(report.date, "MMM dd")}</p>
                            <p className="text-xs text-gray-500">
                              {report.lecturesCompleted}L • {report.questionPracticeHours}h • {report.oldTopicsRevised}R
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {report.morningSession && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/50"
                              >
                                M
                              </Badge>
                            )}
                            {report.exerciseDone && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-500/20 text-green-400 border-green-500/50"
                              >
                                E
                              </Badge>
                            )}
                            {report.distractionsLevel === "None" && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/50"
                              >
                                Z
                              </Badge>
                            )}
                            <span
                              className={`text-xs font-mono ${report.expGained >= 0 ? "text-cyan-400" : "text-red-400"}`}
                            >
                              {report.expGained >= 0 ? "+" : ""}
                              {report.expGained} EXP
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

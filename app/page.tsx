"use client"

import type React from "react"
import { AlertTriangle } from "lucide-react" // Import AlertTriangle here

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarIcon,
  Zap,
  Target,
  Brain,
  Clock,
  Volume2,
  VolumeX,
  Crown,
  Star,
  Sword,
  BarChart3,
  Activity,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { useSoundEffects } from "../hooks/useSoundEffects"
import SubmissionPopup from "../components/SubmissionPopup"
import TargetSettings from "../components/TargetSettings"
import ProgressCharts from "../components/ProgressCharts"
import ExamDateSettings from "../components/ExamDateSettings"
import AdvancedAnalytics from "../components/AdvancedAnalytics"

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

  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Magical energy particles
    const particles = [];
    const maxParticles = 80;

    class MagicalParticle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.life = Math.random() * 200 + 100;
        this.maxLife = this.life;
        this.size = Math.random() * 1.5 + 0.5;
        this.color = this.getRandomColor();
        this.glowSize = Math.random() * 10 + 5;
      }

      getRandomColor() {
        const colors = [
          '#8B5CF6', // Purple
          '#3B82F6', // Blue
          '#06B6D4', // Cyan
          '#10B981', // Emerald
          '#F59E0B', // Amber
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // Floating movement
        this.vx += (Math.random() - 0.5) * 0.01;
        this.vy += (Math.random() - 0.5) * 0.01;

        // Boundary wrap
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        if (this.life <= 0) {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
          this.life = this.maxLife;
          this.color = this.getRandomColor();
        }
      }

      draw() {
        const alpha = this.life / this.maxLife;

        // Glow effect
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.glowSize;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Core particle
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Initialize particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new MagicalParticle());
    }

    // System interface elements
    const systemElements = [];
    const createSystemElement = () => {
      const element = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        width: Math.random() * 200 + 100,
        height: Math.random() * 80 + 40,
        alpha: 0,
        targetAlpha: Math.random() * 0.3 + 0.1,
        life: Math.random() * 300 + 200,
        maxLife: 500,
        type: Math.random() > 0.5 ? 'window' : 'progress'
      };
      return element;
    };

    // Create initial system elements
    for (let i = 0; i < 5; i++) {
      systemElements.push(createSystemElement());
    }

    // Draw system interface windows
    const drawSystemElement = (element) => {
      ctx.save();
      ctx.globalAlpha = element.alpha;

      if (element.type === 'window') {
        // Window frame
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2;
        ctx.strokeRect(element.x, element.y, element.width, element.height);

        // Window background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(element.x, element.y, element.width, element.height);

        // Window title bar
        ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.fillRect(element.x, element.y, element.width, 25);

        // Window lines
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = '#8B5CF6';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(element.x + 10, element.y + 35 + i * 12);
          ctx.lineTo(element.x + element.width - 10, element.y + 35 + i * 12);
          ctx.stroke();
        }
      } else {
        // Progress bar
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.strokeRect(element.x, element.y, element.width, 20);

        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        const progress = (element.life / element.maxLife) * element.width;
        ctx.fillRect(element.x, element.y, progress, 20);
      }

      ctx.restore();
    };

    // Digital rain effect
    const rainDrops = [];
    const createRainDrop = () => {
      return {
        x: Math.random() * canvas.width,
        y: -20,
        speed: Math.random() * 3 + 2,
        char: String.fromCharCode(Math.random() * 26 + 65),
        alpha: Math.random() * 0.5 + 0.3
      };
    };

    for (let i = 0; i < 30; i++) {
      rainDrops.push(createRainDrop());
    }

    let time = 0;
    const animate = () => {
      time++;

      // Dark gradient background
      const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
      gradient.addColorStop(0, 'rgba(15, 15, 30, 0.95)');
      gradient.addColorStop(0.5, 'rgba(8, 8, 20, 0.98)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw magical particles
      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      // Update and draw system elements
      systemElements.forEach((element, index) => {
        element.life--;

        if (element.alpha < element.targetAlpha) {
          element.alpha += 0.01;
        }

        if (element.life <= 0) {
          systemElements[index] = createSystemElement();
        }

        drawSystemElement(element);
      });

      // Digital rain
      rainDrops.forEach((drop, index) => {
        drop.y += drop.speed;

        if (drop.y > canvas.height) {
          rainDrops[index] = createRainDrop();
        }

        ctx.save();
        ctx.globalAlpha = drop.alpha;
        ctx.fillStyle = '#8B5CF6';
        ctx.font = '12px monospace';
        ctx.fillText(drop.char, drop.x, drop.y);
        ctx.restore();
      });

      // Pulsing energy waves
      if (time % 180 === 0) {
        const waveX = Math.random() * canvas.width;
        const waveY = Math.random() * canvas.height;

        for (let i = 0; i < 30; i++) {
          setTimeout(() => {
            ctx.save();
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(waveX, waveY, i * 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }, i * 20);
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">

      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        className=" inset-0 w-full h-full fixed"
      />
      <div className="absolute inset-0 overflow-hidden">
        <div className="energy-stream stream-1"></div>
        <div className="energy-stream stream-2"></div>
        <div className="energy-stream stream-3"></div>
      </div>
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
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-700">
            <TabsTrigger value="tracker" className="data-[state=active]:bg-cyan-600">
              <Target className="w-4 h-4 mr-2" />
              Hunter Tracker
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-cyan-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Progress Charts
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-cyan-600">
              <Activity className="w-4 h-4 mr-2" />
              Advanced Analytics
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
                              className="w-full justify-start text-left font-normal bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-200"
                              onClick={handleButtonClick}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                if (date) {
                                  setSelectedDate(date)
                                  handleButtonClick()
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
                          <Zap className="w-5 h-5 mr-2" />
                          EXP Gaining Activities
                        </h3>

                        <div className="grid grid-cols-1 items-center md:grid-cols-2 gap-4 mb-4 ">
                          <div className="space-y-2 ">
                            <Label htmlFor="lectures" className="text-gray-300">
                              Lectures Completed
                            </Label>
                            <Input
                              id="lectures"
                              type="number"
                              value={formData.lecturesCompleted}
                              onChange={(e) =>
                                setFormData({ ...formData, lecturesCompleted: Number.parseInt(e.target.value) || 0 })
                              }
                              className="bg-gray-800 h-11 border-gray-600 text-gray-200 focus:ring-cyan-500"

                              onClick={handleButtonClick}
                            />
                            <p
                              className={`text-sm ${getTargetProgress(formData.lecturesCompleted, dailyTargets.lecturesCompleted)}`}
                            >
                              Target: {dailyTargets.lecturesCompleted}
                            </p>
                          </div>

                          <div className="space-y-2 flex flex-row h-11  items-center justify-between px-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="postLectureRevision" className="text-gray-300">
                              Post-Lecture Revision
                            </Label>
                            <Switch
                              id="postLectureRevision"
                              checked={formData.postLectureRevision}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, postLectureRevision: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-cyan-600"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label htmlFor="oldTopicsRevised" className="text-gray-300">
                              Old Topics Revised
                            </Label>
                            <Input
                              id="oldTopicsRevised"
                              type="number"
                              value={formData.oldTopicsRevised}
                              onChange={(e) =>
                                setFormData({ ...formData, oldTopicsRevised: Number.parseInt(e.target.value) || 0 })
                              }
                              className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-cyan-500"
                              onClick={handleButtonClick}
                            />
                            <p
                              className={`text-sm ${getTargetProgress(formData.oldTopicsRevised, dailyTargets.oldTopicsRevised)}`}
                            >
                              Target: {dailyTargets.oldTopicsRevised}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="questionPracticeHours" className="text-gray-300">
                              Question Practice (Hours)
                            </Label>
                            <Input
                              id="questionPracticeHours"
                              type="number"
                              step="0.1"
                              value={formData.questionPracticeHours}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  questionPracticeHours: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                              className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-cyan-500"
                              onClick={handleButtonClick}
                            />
                            <p
                              className={`text-sm ${getTargetProgress(formData.questionPracticeHours, dailyTargets.questionPracticeHours)}`}
                            >
                              Target: {dailyTargets.questionPracticeHours}h
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="morningSession" className="text-gray-300">
                              Morning Session (before 9 AM)
                            </Label>
                            <Switch
                              id="morningSession"
                              checked={formData.morningSession}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, morningSession: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-cyan-600"
                            />
                          </div>
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="exerciseDone" className="text-gray-300">
                              Exercise Done
                            </Label>
                            <Switch
                              id="exerciseDone"
                              checked={formData.exerciseDone}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, exerciseDone: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-cyan-600"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700 mt-4">
                          <Label htmlFor="goalVisualization" className="text-gray-300">
                            Goal Visualization
                          </Label>
                          <Switch
                            id="goalVisualization"
                            checked={formData.goalVisualization}
                            onCheckedChange={(checked) => {
                              setFormData({ ...formData, goalVisualization: checked })
                              handleToggleSwitch()
                            }}
                            className="data-[state=checked]:bg-cyan-600"
                          />
                        </div>
                      </div>

                      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2" />
                          EXP Draining Activities
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="missedLecture" className="text-gray-300">
                              Missed Lecture
                            </Label>
                            <Switch
                              id="missedLecture"
                              checked={formData.missedLecture}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, missedLecture: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-red-600"
                            />
                          </div>
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="noRevision" className="text-gray-300">
                              No Revision
                            </Label>
                            <Switch
                              id="noRevision"
                              checked={formData.noRevision}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, noRevision: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-red-600"
                            />
                          </div>
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="noQuestionPractice" className="text-gray-300">
                              No Question Practice
                            </Label>
                            <Switch
                              id="noQuestionPractice"
                              checked={formData.noQuestionPractice}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, noQuestionPractice: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-red-600"
                            />
                          </div>
                          <div className="space-y-2 flex items-center justify-between p-2 rounded-md bg-gray-800 border border-gray-700">
                            <Label htmlFor="oversleeping" className="text-gray-300">
                              Oversleeping
                            </Label>
                            <Switch
                              id="oversleeping"
                              checked={formData.oversleeping}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, oversleeping: checked })
                                handleToggleSwitch()
                              }}
                              className="data-[state=checked]:bg-red-600"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="distractionsLevel" className="text-gray-300">
                            Distractions Level
                          </Label>
                          <Select
                            value={formData.distractionsLevel}
                            onValueChange={(value) => {
                              setFormData({ ...formData, distractionsLevel: value })
                              handleButtonClick()
                            }}
                          >
                            <SelectTrigger className="w-full bg-gray-800 border-gray-600 text-gray-200 focus:ring-cyan-500">
                              <SelectValue placeholder="Select distraction level" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600 text-gray-200">
                              <SelectItem value="None">None</SelectItem>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mentalState" className="text-gray-300">
                            Mental State
                          </Label>
                          <Input
                            id="mentalState"
                            value={formData.mentalState}
                            onChange={(e) => setFormData({ ...formData, mentalState: e.target.value })}
                            placeholder="e.g., Focused, Tired, Motivated"
                            className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-cyan-500"
                            onClick={handleButtonClick}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="finalComment" className="text-gray-300">
                            Final Comment
                          </Label>
                          <Textarea
                            id="finalComment"
                            value={formData.finalComment}
                            onChange={(e) => setFormData({ ...formData, finalComment: e.target.value })}
                            placeholder="Any additional notes or reflections for today?"
                            className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-cyan-500"
                            rows={3}
                            onClick={handleButtonClick}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                        onClick={handleButtonClick}
                      >
                        Submit Daily Report
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-700">
                    <CardTitle className="text-2xl font-bold text-purple-400 flex items-center">
                      <Crown className="w-6 h-6 mr-2" />
                      Hunter Rank
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 text-center">
                    <div
                      className="w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold border-8 mx-auto mb-4 relative"
                      style={{
                        backgroundColor: currentRank.color,
                        borderColor: currentRank.glowColor,
                        boxShadow: `0 0 30px ${currentRank.glowColor}`,
                      }}
                    >
                      {currentRank.name}
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-2">{currentRank.fullName}</h3>
                    <p className="text-gray-400 text-lg mb-4">{currentRank.meaning}</p>
                    <div className="text-left mb-4">
                      <p className="text-gray-300 text-sm">
                        <span className="font-semibold">GATE Interpretation:</span> {currentRank.gateInterpretation}
                      </p>
                      <p className="text-gray-300 text-sm mt-1">
                        <span className="font-semibold">Mental State:</span> {currentRank.mentalState}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-lg font-semibold text-gray-300 mb-2">
                      <span>EXP:</span>
                      <span className="text-yellow-400">{currentExp}</span>
                    </div>
                    <Progress
                      value={getExpProgress()}
                      className="h-3 bg-gray-700"
                      indicatorClassName="bg-gradient-to-r from-yellow-400 to-orange-500"
                    />
                    {getNextRank() && (
                      <p className="text-sm text-gray-500 mt-2">
                        {currentRank.maxExp - currentExp} EXP to {getNextRank()?.name}-Rank
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-700">
                    <CardTitle className="text-2xl font-bold text-orange-400 flex items-center">
                      <Brain className="w-6 h-6 mr-2" />
                      Daily Wisdom
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-gray-300 text-lg italic text-center">"{currentQuote}"</p>
                  </CardContent>
                </Card>

                <ExamDateSettings examDate={examDate} setExamDate={setExamDate} onSoundClick={handleButtonClick} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <ProgressCharts dailyReports={dailyReports} dailyTargets={dailyTargets} />
          </TabsContent>

          <TabsContent value="advanced" className="mt-6">
            <AdvancedAnalytics
              dailyReports={dailyReports}
              dailyTargets={dailyTargets}
              currentExp={currentExp}
              daysRemaining={daysRemaining}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

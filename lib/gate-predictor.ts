/**
 * GATE Marks Predictor & Derivative Prediction System
 *
 * Mathematical Engine:
 * - Maps Solo Leveling hunter ranks to authentic GATE 100-mark scoring bands:
 *     SSS: 80 - 100 marks (AIR 1 - 50, IISc / IIT Bombay Top Tier)
 *     SS:  70 - 80 marks  (AIR 50 - 300, Top 5 Old IITs direct calls)
 *     S:   60 - 70 marks  (AIR 300 - 1,000, Old IITs / Top NITs / IIIT-H)
 *     A:   50 - 60 marks  (AIR 1,000 - 3,000, Newer IITs / Top NITs)
 *     B:   40 - 50 marks  (AIR 3,000 - 7,000, Established NITs & State Top)
 *     C:   32 - 40 marks  (AIR 7,000 - 15,000, Comfortably GATE Qualified)
 *     D:   25 - 32 marks  (AIR 15,000 - 30,000, Cutoff Boundary Margin)
 *     E:    0 - 25 marks  (Below Qualifying Cutoff, Foundational Phase)
 *
 * - Derivative Prediction Engine:
 *     First Derivative  dM/dt   : Instantaneous & smoothed improvement velocity (marks / week)
 *     Second Derivative d²M/dt² : Acceleration / momentum (marks / week²)
 *     Logistic / Kinematic Extrapolation: Projects trajectory forward to target exam date
 */

import { format, subDays, addDays, differenceInDays, isSameDay } from "date-fns"
import {
  RANKS,
  getRank,
  getNextRank,
  getRankProgressDetails,
  type RankInfo,
  type RankName,
  type WeeklyStudyStats,
} from "./ranks.ts"

export interface GateRankThreshold {
  rank: RankName
  minMarks: number
  maxMarks: number
  airRange: string
  percentile: string
  targetOutlook: string
  actionAdvice: string
  color: string
}

export const GATE_RANK_THRESHOLDS: Record<RankName, GateRankThreshold> = {
  SSS: {
    rank: "SSS",
    minMarks: 80,
    maxMarks: 100,
    airRange: "AIR 1 – 50",
    percentile: "99.95+ percentile",
    targetOutlook: "Guaranteed IISc Bangalore CSA, IIT Bombay CS, Maharatna PSU Top Shortlist",
    actionAdvice: "Refine full mock simulations to eliminate negative marks and clock 3-hour speed endurance.",
    color: "#EAB308", // Golden Yellow
  },
  SS: {
    rank: "SS",
    minMarks: 70,
    maxMarks: 80,
    airRange: "AIR 50 – 300",
    percentile: "99.7+ percentile",
    targetOutlook: "Top 5 Old IITs (Madras/Delhi/Kanpur/KGP) direct calls, Premier PSU shortlist",
    actionAdvice: "Target complex NAT (Numerical Answer Type) questions and multi-select edge cases.",
    color: "#A855F7", // Purple
  },
  S: {
    rank: "S",
    minMarks: 60,
    maxMarks: 70,
    airRange: "AIR 300 – 1,000",
    percentile: "99.0+ percentile",
    targetOutlook: "Old IITs (Roorkee/Guwahati), Top NITs (Trichy/Surathkal), IIIT Hyderabad",
    actionAdvice: "Solidify core subjects (Algorithms, CN, OS, DBMS) with timed full-length tests.",
    color: "#3B82F6", // Blue
  },
  A: {
    rank: "A",
    minMarks: 50,
    maxMarks: 60,
    airRange: "AIR 1,000 – 3,000",
    percentile: "97.0+ percentile",
    targetOutlook: "Newer IITs (Hyderabad/Indore/Ropar), Premier NITs M.Tech, BITS Pilani",
    actionAdvice: "Bridge accuracy gaps: eliminate negative marks in 1-mark & 2-mark MCQs.",
    color: "#10B981", // Emerald
  },
  B: {
    rank: "B",
    minMarks: 40,
    maxMarks: 50,
    airRange: "AIR 3,000 – 7,000",
    percentile: "94.0+ percentile",
    targetOutlook: "Established NITs, IIITs (Allahabad/Bangalore), State Top Engineering Colleges",
    actionAdvice: "Increase numerical practice hours; ensure formula recall across all core subjects.",
    color: "#06B6D4", // Cyan
  },
  C: {
    rank: "C",
    minMarks: 32,
    maxMarks: 40,
    airRange: "AIR 7,000 – 15,000",
    percentile: "88.0+ percentile",
    targetOutlook: "GATE Qualified! Margin above general cutoff (~28-32M), State Universities",
    actionAdvice: "Focus on guaranteed high-yield topics (Engineering Mathematics + General Aptitude: 28M).",
    color: "#F97316", // Orange
  },
  D: {
    rank: "D",
    minMarks: 25,
    maxMarks: 32,
    airRange: "AIR 15,000 – 30,000",
    percentile: "75.0+ percentile",
    targetOutlook: "Qualifying Cutoff Threshold Zone (~25 to 28 marks). Borderline qualified status",
    actionAdvice: "Lock down General Aptitude (15M) and easy discrete math PYQs to guarantee qualification.",
    color: "#E11D48", // Rose
  },
  E: {
    rank: "E",
    minMarks: 0,
    maxMarks: 25,
    airRange: "Below Qualifying Cutoff",
    percentile: "< 75.0 percentile",
    targetOutlook: "Unranked foundational awakening phase. Focus on concept building.",
    actionAdvice: "Complete foundational syllabus modules and establish a 1.5h daily study habit.",
    color: "#71717A", // Zinc/Muted
  },
}

export interface DerivativeDataPoint {
  date: string
  label: string
  fullDate: string
  actualMarks: number | null
  predictedMarks: number
  optimisticMarks: number | null
  conservativeMarks: number | null
  velocity: number // dM/dt in marks/week
  acceleration: number // d²M/dt² in marks/week²
  isProjected: boolean
  rankName: RankName
  annotation?: string
}

export interface GatePredictorResult {
  currentMarks: number
  predictedRange: [number, number]
  currentRank: RankInfo
  currentThreshold: GateRankThreshold
  projectedExamMarks: number
  projectedRank: RankInfo
  projectedThreshold: GateRankThreshold
  velocity: number // marks gained per week (dM/dt)
  acceleration: number // marks gained per week squared (d²M/dt²)
  daysToSSS: number | null // null if already >= 80 or negative slope
  plateauRisk: boolean
  momentumLabel: "Accelerating" | "Steady Ascent" | "Plateau Warning" | "Declining"
  momentumColor: string
  chartData: DerivativeDataPoint[]
  daysToExam: number | null
  examDateStr: string | null
}

export interface GatePredictorInput {
  dailyReports?: Array<{
    report_date?: string
    date?: string | Date
    practice_hours?: number
    practiceHours?: number
    exp_gained?: number
    expGained?: number
    lectures_completed?: number
    topics_revised?: number
  }>
  mockAttempts?: Array<{
    marksObtained?: number
    totalMarks?: number
    scorePct?: number
    attemptedAt?: string | Date
  }>
  currentExp: number
  weeklyStudyStats: WeeklyStudyStats
  examDate?: string | Date | null
  currentRank?: RankInfo
}

/**
 * Maps any score (0-100) to its corresponding Solo Leveling Hunter Rank.
 */
export function getRankFromGateScore(score: number): RankInfo {
  const safe = Math.max(0, Math.min(100, score))
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const r = RANKS[i]
    if (safe >= r.gateMarksMin) {
      return r
    }
  }
  return RANKS[0]
}

/**
 * Calculates dynamic GATE marks and runs the derivative projection system.
 */
export function calculateGateMarksPrediction(input: GatePredictorInput): GatePredictorResult {
  const {
    dailyReports = [],
    mockAttempts = [],
    currentExp = 0,
    weeklyStudyStats,
    examDate,
  } = input

  // 1. Current rank & baseline marks calculation
  const effectiveHours = weeklyStudyStats?.effectiveWeeklyHours || 0
  const activeRank = input.currentRank || getRank(currentExp, effectiveHours)
  const nextRank = getNextRank(activeRank.name)
  const progressDetails = getRankProgressDetails(currentExp, effectiveHours, activeRank, nextRank)

  // Span of the current rank's GATE marks
  const markSpan = activeRank.gateMarksMax - activeRank.gateMarksMin
  const baseFraction = (progressDetails.overallProgress / 100) * markSpan
  let baseMarks = activeRank.gateMarksMin + baseFraction

  // Study hours consistency factor (reward exceeding min hours, penalize falling short)
  const targetHours = Math.max(7, activeRank.minWeeklyHours)
  const consistencyRatio = Math.min(1.3, Math.max(0.7, effectiveHours / targetHours))
  const consistencyAdjustment = (consistencyRatio - 1.0) * 2.5
  baseMarks = Math.min(100, Math.max(0, baseMarks + consistencyAdjustment))

  // Incorporate empirical mock test scores if available
  let currentMarks = baseMarks
  const validMocks = mockAttempts
    .filter((m) => typeof m.scorePct === "number" && !isNaN(m.scorePct))
    .sort((a, b) => new Date(a.attemptedAt || 0).getTime() - new Date(b.attemptedAt || 0).getTime())

  if (validMocks.length > 0) {
    // Recent mocks carry strong predictive weight
    const recentMocks = validMocks.slice(-5)
    const avgMockScore =
      recentMocks.reduce((sum, m) => sum + (Number(m.scorePct) || 0), 0) / recentMocks.length

    // Blended estimate: 60% mock test evidence + 40% study volume/rank
    currentMarks = 0.6 * avgMockScore + 0.4 * baseMarks
  }

  currentMarks = Number(Math.min(100, Math.max(0, currentMarks)).toFixed(1))

  // Confidence margin (narrower with more mocks & study data)
  const dataConfidenceBuffer = validMocks.length >= 3 ? 2.5 : 4.0
  const minPredicted = Number(Math.max(0, currentMarks - dataConfidenceBuffer).toFixed(1))
  const maxPredicted = Number(Math.min(100, currentMarks + dataConfidenceBuffer).toFixed(1))

  // 2. Exam Date & Days Remaining
  let daysToExam: number | null = null
  let examDateStr: string | null = null
  if (examDate) {
    const parsedExam = typeof examDate === "string" ? new Date(examDate + "T00:00:00") : examDate
    if (!isNaN(parsedExam.getTime())) {
      daysToExam = Math.max(0, differenceInDays(parsedExam, new Date()))
      examDateStr = format(parsedExam, "MMM dd, yyyy")
    }
  }

  // 3. Build Historical Timeline for Derivative Analysis (Last 21 days)
  const historyPoints: DerivativeDataPoint[] = []
  const today = new Date()
  const daysOfHistory = 14

  // Estimate past marks progression across the last 14 days
  for (let i = daysOfHistory; i >= 0; i--) {
    const d = subDays(today, i)
    const dIso = format(d, "yyyy-MM-dd")
    const dLabel = format(d, "MMM dd")

    // Find if mock test occurred on this day
    const mockOnDay = validMocks.find((m) =>
      isSameDay(new Date(m.attemptedAt || 0), d),
    )

    // Calculate historical readiness with gradual ramp based on EXP & date
    const dayProgressFraction = (daysOfHistory - i) / daysOfHistory
    const pastDelta = (daysOfHistory - i) * 0.22 // Baseline historical learning climb
    const dayBaseMarks = Math.max(
      activeRank.gateMarksMin,
      currentMarks - (daysOfHistory - i) * 0.25,
    )

    const dayActual = mockOnDay ? Number(mockOnDay.scorePct?.toFixed(1)) : null
    const dayPredicted = dayActual !== null ? dayActual : Number((dayBaseMarks + pastDelta).toFixed(1))

    const boundedDayMarks = Math.min(100, Math.max(0, dayPredicted))
    const dayRank = getRankFromGateScore(boundedDayMarks)

    historyPoints.push({
      date: dIso,
      label: i === 0 ? "Today" : dLabel,
      fullDate: dIso,
      actualMarks: dayActual,
      predictedMarks: boundedDayMarks,
      optimisticMarks: null,
      conservativeMarks: null,
      velocity: 0, // will compute below
      acceleration: 0, // will compute below
      isProjected: false,
      rankName: dayRank.name,
      annotation: i === 0 ? `Current: ${currentMarks}M` : mockOnDay ? `Mock: ${dayActual}M` : undefined,
    })
  }

  // Compute Discrete First Derivative (Velocity = dM/dt in marks per 7 days)
  for (let i = 1; i < historyPoints.length; i++) {
    const prev = historyPoints[i - 1]
    const curr = historyPoints[i]
    // Delta marks per 1 day * 7 = marks per week
    const v = Number(((curr.predictedMarks - prev.predictedMarks) * 7).toFixed(2))
    curr.velocity = v
  }
  historyPoints[0].velocity = historyPoints[1]?.velocity || 1.5

  // Compute Discrete Second Derivative (Acceleration = d²M/dt² in marks per week²)
  for (let i = 1; i < historyPoints.length; i++) {
    const prevV = historyPoints[i - 1].velocity
    const currV = historyPoints[i].velocity
    const a = Number((currV - prevV).toFixed(2))
    historyPoints[i].acceleration = a
  }
  historyPoints[0].acceleration = 0

  // 4. Calculate Current Velocity and Acceleration (EWMA)
  const recentHistory = historyPoints.slice(-5)
  const rawVelocity =
    recentHistory.reduce((sum, p) => sum + p.velocity, 0) / recentHistory.length

  // Modulate velocity based on weekly study consistency
  // If student studies > 30 hrs/wk, velocity increases; if < 10 hrs/wk, velocity slows
  let currentVelocity = rawVelocity
  if (effectiveHours >= 42) {
    currentVelocity = Math.max(currentVelocity, 2.8)
  } else if (effectiveHours >= 28) {
    currentVelocity = Math.max(currentVelocity, 1.8)
  } else if (effectiveHours >= 14) {
    currentVelocity = Math.max(currentVelocity, 1.2)
  } else if (effectiveHours < 7) {
    currentVelocity = Math.min(currentVelocity, 0.5)
  }

  currentVelocity = Number(currentVelocity.toFixed(2))

  const currentAcceleration = Number(
    (historyPoints[historyPoints.length - 1]?.acceleration || 0.1).toFixed(2),
  )

  // Momentum diagnosis
  let momentumLabel: GatePredictorResult["momentumLabel"] = "Steady Ascent"
  let momentumColor = "#3B82F6"

  if (currentVelocity >= 2.5 && currentAcceleration >= -0.1) {
    momentumLabel = "Accelerating"
    momentumColor = "#10B981" // Emerald
  } else if (currentVelocity < 0.5) {
    momentumLabel = "Plateau Warning"
    momentumColor = "#EAB308" // Amber
  } else if (currentVelocity < 0) {
    momentumLabel = "Declining"
    momentumColor = "#EF4444" // Red
  }

  const plateauRisk = currentVelocity < 0.6 && currentMarks < 75

  // 5. Kinematic / Logistic Extrapolation into the Future (Target: up to 60 days or exam date)
  const projectionDays = Math.min(90, Math.max(28, daysToExam || 42))
  const projectionIntervals = 5 // e.g. +1w, +2w, +3w, +4w, +6w
  const futurePoints: DerivativeDataPoint[] = []

  const stepDays = Math.max(7, Math.floor(projectionDays / projectionIntervals))

  let lastProjectedMark = currentMarks
  let projectedVelocity = currentVelocity

  for (let step = 1; step <= projectionIntervals; step++) {
    const futureDayOffset = step * stepDays
    const futureDate = addDays(today, futureDayOffset)
    const futureIso = format(futureDate, "yyyy-MM-dd")
    const weeksFromNow = futureDayOffset / 7

    // Logistic saturation factor: each mark becomes harder to gain as student nears 100
    // dM/dt = v0 * (100 - M) / (100 - 30)
    const headroomFactor = Math.max(0.1, (100 - lastProjectedMark) / 70)
    projectedVelocity = Math.max(0.2, currentVelocity * headroomFactor)

    // Taylor expansion with exponential saturation damping
    const addedMarks = projectedVelocity * (stepDays / 7)
    lastProjectedMark = Math.min(99.0, Math.max(currentMarks, lastProjectedMark + addedMarks))
    const boundedFutureMarks = Number(lastProjectedMark.toFixed(1))

    // Confidence corridor expanding with time horizon (sqrt of weeks)
    const expansion = Math.sqrt(weeksFromNow) * 1.5
    const opt = Number(Math.min(100, boundedFutureMarks + expansion).toFixed(1))
    const cons = Number(Math.max(currentMarks - 1, boundedFutureMarks - expansion * 1.2).toFixed(1))

    const futureRank = getRankFromGateScore(boundedFutureMarks)

    futurePoints.push({
      date: futureIso,
      label: `+${Math.round(weeksFromNow)}w`,
      fullDate: futureIso,
      actualMarks: null,
      predictedMarks: boundedFutureMarks,
      optimisticMarks: opt,
      conservativeMarks: cons,
      velocity: Number(projectedVelocity.toFixed(2)),
      acceleration: Number((-0.05 * step).toFixed(2)), // slight deceleration as marks peak
      isProjected: true,
      rankName: futureRank.name,
      annotation:
        step === projectionIntervals
          ? `Exam Projection: ${boundedFutureMarks}M (${futureRank.name}-Rank)`
          : undefined,
    })
  }

  // Combined Chart Series
  const chartData: DerivativeDataPoint[] = [...historyPoints, ...futurePoints]

  // Calculate projected exam marks (the last projection point)
  const finalProjectionPoint = futurePoints[futurePoints.length - 1]
  const projectedExamMarks = finalProjectionPoint ? finalProjectionPoint.predictedMarks : currentMarks
  const projectedRank = getRankFromGateScore(projectedExamMarks)

  // Calculate Days to SSS Rank (80 marks)
  let daysToSSS: number | null = null
  if (currentMarks >= 80) {
    daysToSSS = 0 // Already at SSS Rank!
  } else if (currentVelocity > 0.1) {
    const marksDeficit = 80 - currentMarks
    const weeksNeeded = marksDeficit / currentVelocity
    daysToSSS = Math.max(1, Math.round(weeksNeeded * 7))
  }

  const currentThreshold = GATE_RANK_THRESHOLDS[activeRank.name]
  const projectedThreshold = GATE_RANK_THRESHOLDS[projectedRank.name]

  return {
    currentMarks,
    predictedRange: [minPredicted, maxPredicted],
    currentRank: activeRank,
    currentThreshold,
    projectedExamMarks,
    projectedRank,
    projectedThreshold,
    velocity: currentVelocity,
    acceleration: currentAcceleration,
    daysToSSS,
    plateauRisk,
    momentumLabel,
    momentumColor,
    chartData,
    daysToExam,
    examDateStr,
  }
}

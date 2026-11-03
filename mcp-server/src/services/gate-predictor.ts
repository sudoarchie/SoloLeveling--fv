import { format, subDays, addDays, differenceInDays } from "date-fns"
import {
  RANKS,
  getRank,
  getRankProgressDetails,
  getNextRank,
} from "./ranks.js"
import type {
  RankInfo,
  RankName,
  WeeklyStudyStats,
  GateRankThreshold,
  DerivativeDataPoint,
  GatePredictorResult,
  DailyReportRow,
  MockAttemptRow,
} from "../types.js"

export const GATE_RANK_THRESHOLDS: Record<RankName, GateRankThreshold> = {
  SSS: {
    rank: "SSS",
    minMarks: 80,
    maxMarks: 100,
    airRange: "AIR 1 – 50",
    percentile: "99.95+ percentile",
    targetOutlook: "Guaranteed IISc Bangalore CSA, IIT Bombay CS, Maharatna PSU Top Shortlist",
    actionAdvice: "Refine full mock simulations to eliminate negative marks and clock 3-hour speed endurance.",
    color: "#EAB308",
  },
  SS: {
    rank: "SS",
    minMarks: 70,
    maxMarks: 80,
    airRange: "AIR 50 – 300",
    percentile: "99.7+ percentile",
    targetOutlook: "Top 5 Old IITs (Madras/Delhi/Kanpur/KGP) direct calls, Premier PSU shortlist",
    actionAdvice: "Target complex NAT (Numerical Answer Type) questions and multi-select edge cases.",
    color: "#A855F7",
  },
  S: {
    rank: "S",
    minMarks: 60,
    maxMarks: 70,
    airRange: "AIR 300 – 1,000",
    percentile: "99.0+ percentile",
    targetOutlook: "Old IITs (Roorkee/Guwahati), Top NITs (Trichy/Surathkal), IIIT Hyderabad",
    actionAdvice: "Solidify core subjects (Algorithms, CN, OS, DBMS) with timed full-length tests.",
    color: "#3B82F6",
  },
  A: {
    rank: "A",
    minMarks: 50,
    maxMarks: 60,
    airRange: "AIR 1,000 – 3,000",
    percentile: "97.0+ percentile",
    targetOutlook: "Newer IITs (Hyderabad/Indore/Ropar), Premier NITs M.Tech, BITS Pilani",
    actionAdvice: "Bridge accuracy gaps: eliminate negative marks in 1-mark & 2-mark MCQs.",
    color: "#10B981",
  },
  B: {
    rank: "B",
    minMarks: 40,
    maxMarks: 50,
    airRange: "AIR 3,000 – 7,000",
    percentile: "94.0+ percentile",
    targetOutlook: "Established NITs, IIITs (Allahabad/Bangalore), State Top Engineering Colleges",
    actionAdvice: "Increase numerical practice hours; ensure formula recall across all core subjects.",
    color: "#06B6D4",
  },
  C: {
    rank: "C",
    minMarks: 32,
    maxMarks: 40,
    airRange: "AIR 7,000 – 15,000",
    percentile: "88.0+ percentile",
    targetOutlook: "GATE Qualified! Margin above general cutoff (~28-32M), State Universities",
    actionAdvice: "Focus on guaranteed high-yield topics (Engineering Mathematics + General Aptitude: 28M).",
    color: "#F97316",
  },
  D: {
    rank: "D",
    minMarks: 25,
    maxMarks: 32,
    airRange: "AIR 15,000 – 30,000",
    percentile: "75.0+ percentile",
    targetOutlook: "Qualifying Cutoff Threshold Zone (~25 to 28 marks). Borderline qualified status",
    actionAdvice: "Lock down General Aptitude (15M) and easy discrete math PYQs to guarantee qualification.",
    color: "#E11D48",
  },
  E: {
    rank: "E",
    minMarks: 0,
    maxMarks: 25,
    airRange: "Below Qualifying Cutoff",
    percentile: "< 75.0 percentile",
    targetOutlook: "Unranked foundational awakening phase. Focus on concept building.",
    actionAdvice: "Complete foundational syllabus modules and establish a 1.5h daily study habit.",
    color: "#71717A",
  },
}

export function getRankFromGateScore(score: number): RankInfo {
  const s = Math.max(0, Math.min(100, score))
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const r = RANKS[i]
    if (s >= r.gateMarksMin) {
      return r
    }
  }
  return RANKS[0]
}

export function calculateGateMarksPrediction(params: {
  dailyReports: Partial<DailyReportRow>[]
  mockAttempts: Partial<MockAttemptRow>[]
  currentExp: number
  weeklyStudyStats: WeeklyStudyStats
  examDate?: string | null
  currentRank?: RankInfo
}): GatePredictorResult {
  const {
    dailyReports = [],
    mockAttempts = [],
    currentExp = 0,
    weeklyStudyStats,
    examDate,
    currentRank,
  } = params

  const effectiveHours = weeklyStudyStats.effectiveWeeklyHours
  const activeRank = currentRank || getRank(currentExp, effectiveHours)
  const nextRank = getNextRank(activeRank.name)
  const progressDetails = getRankProgressDetails(currentExp, effectiveHours, activeRank, nextRank)

  const rankSpan = activeRank.gateMarksMax - activeRank.gateMarksMin
  const fractionalMarks = (progressDetails.overallProgress / 100) * rankSpan
  const baseMarksFromRank = activeRank.gateMarksMin + fractionalMarks

  // Mock attempts weighting
  let weightedMarks = baseMarksFromRank
  const validMockAttempts = mockAttempts
    .filter((a) => a.marks_obtained !== undefined && a.total_marks !== undefined && Number(a.total_marks) > 0)
    .map((a) => ({
      marks: (Number(a.marks_obtained) / Number(a.total_marks)) * 100,
      date: a.attempted_at ? new Date(a.attempted_at) : new Date(),
    }))

  if (validMockAttempts.length > 0) {
    const sorted = [...validMockAttempts].sort((a, b) => b.date.getTime() - a.date.getTime())
    const recent = sorted.slice(0, 5)
    let totalWeight = 0
    let sumWeightedScores = 0
    recent.forEach((attempt, idx) => {
      const weight = 1 / (idx + 1)
      sumWeightedScores += attempt.marks * weight
      totalWeight += weight
    })
    const avgRecentMockMarks = sumWeightedScores / totalWeight
    weightedMarks = baseMarksFromRank * 0.55 + avgRecentMockMarks * 0.45
  }

  const currentMarks = Number(Math.min(99.0, Math.max(0, weightedMarks)).toFixed(1))
  const minPredicted = Number(Math.max(0, currentMarks - 4.0).toFixed(1))
  const maxPredicted = Number(Math.min(100, currentMarks + 4.0).toFixed(1))

  const today = new Date()
  let daysToExam: number | null = null
  let examDateStr: string | null = null

  if (examDate) {
    try {
      const examD = new Date(examDate + "T00:00:00")
      if (!isNaN(examD.getTime())) {
        daysToExam = Math.max(0, differenceInDays(examD, today))
        examDateStr = examDate
      }
    } catch {}
  }

  // Historical derivative trajectory (past 4 weeks)
  const historyPoints: DerivativeDataPoint[] = []
  const historyWeeks = 4

  for (let w = historyWeeks; w >= 0; w--) {
    const datePoint = subDays(today, w * 7)
    const dateIso = format(datePoint, "yyyy-MM-dd")

    const historicalLagFactor = 1 - w * 0.04
    const simulatedHistoricalMark = Number(
      Math.max(0, currentMarks * historicalLagFactor - w * 0.5).toFixed(1),
    )

    let mockMarkOnWeek: number | null = null
    const weekStart = subDays(datePoint, 3)
    const weekEnd = addDays(datePoint, 3)
    const matchingAttempt = validMockAttempts.find(
      (a) => a.date >= weekStart && a.date <= weekEnd,
    )
    if (matchingAttempt) {
      mockMarkOnWeek = Number(matchingAttempt.marks.toFixed(1))
    }

    const calculatedVelocity = Number((1.2 + (historyWeeks - w) * 0.15).toFixed(2))

    historyPoints.push({
      date: dateIso,
      label: w === 0 ? "Today" : `-${w}w`,
      fullDate: dateIso,
      actualMarks: mockMarkOnWeek,
      predictedMarks: simulatedHistoricalMark,
      optimisticMarks: Number(Math.min(100, simulatedHistoricalMark + 3.0).toFixed(1)),
      conservativeMarks: Number(Math.max(0, simulatedHistoricalMark - 3.0).toFixed(1)),
      velocity: calculatedVelocity,
      acceleration: 0.1,
      isProjected: false,
      rankName: getRankFromGateScore(simulatedHistoricalMark).name,
    })
  }

  // Velocity modulated by weekly study consistency
  let currentVelocity = 1.2
  if (effectiveHours >= 42) {
    currentVelocity = 2.8
  } else if (effectiveHours >= 28) {
    currentVelocity = 1.8
  } else if (effectiveHours >= 14) {
    currentVelocity = 1.2
  } else if (effectiveHours < 7) {
    currentVelocity = 0.5
  }

  currentVelocity = Number(currentVelocity.toFixed(2))
  const currentAcceleration = 0.1

  let momentumLabel: GatePredictorResult["momentumLabel"] = "Steady Ascent"
  let momentumColor = "#3B82F6"

  if (currentVelocity >= 2.5 && currentAcceleration >= -0.1) {
    momentumLabel = "Accelerating"
    momentumColor = "#10B981"
  } else if (currentVelocity < 0.6) {
    momentumLabel = "Plateau Warning"
    momentumColor = "#EAB308"
  } else if (currentVelocity < 0) {
    momentumLabel = "Declining"
    momentumColor = "#EF4444"
  }

  const plateauRisk = currentVelocity < 0.6 && currentMarks < 75

  // Future Extrapolations (up to exam date or 6 weeks)
  const projectionDays = Math.min(90, Math.max(28, daysToExam || 42))
  const projectionIntervals = 5
  const futurePoints: DerivativeDataPoint[] = []
  const stepDays = Math.max(7, Math.floor(projectionDays / projectionIntervals))

  let lastProjectedMark = currentMarks
  let projectedVelocity = currentVelocity

  for (let step = 1; step <= projectionIntervals; step++) {
    const futureDayOffset = step * stepDays
    const futureDate = addDays(today, futureDayOffset)
    const futureIso = format(futureDate, "yyyy-MM-dd")
    const weeksFromNow = futureDayOffset / 7

    const headroomFactor = Math.max(0.1, (100 - lastProjectedMark) / 70)
    projectedVelocity = Math.max(0.2, currentVelocity * headroomFactor)

    const addedMarks = projectedVelocity * (stepDays / 7)
    lastProjectedMark = Math.min(99.0, Math.max(currentMarks, lastProjectedMark + addedMarks))
    const boundedFutureMarks = Number(lastProjectedMark.toFixed(1))

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
      acceleration: Number((-0.05 * step).toFixed(2)),
      isProjected: true,
      rankName: futureRank.name,
      annotation:
        step === projectionIntervals
          ? `Exam Projection: ${boundedFutureMarks}M (${futureRank.name}-Rank)`
          : undefined,
    })
  }

  const chartData: DerivativeDataPoint[] = [...historyPoints, ...futurePoints]
  const finalProjectionPoint = futurePoints[futurePoints.length - 1]
  const projectedExamMarks = finalProjectionPoint ? finalProjectionPoint.predictedMarks : currentMarks
  const projectedRank = getRankFromGateScore(projectedExamMarks)

  let daysToSSS: number | null = null
  if (currentMarks >= 80) {
    daysToSSS = 0
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

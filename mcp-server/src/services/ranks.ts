import { isWithinInterval, startOfWeek, endOfWeek, subDays } from "date-fns"
import type { RankName, RankInfo, WeeklyStudyStats } from "../types.js"

export const RANKS: RankInfo[] = [
  {
    name: "E",
    title: "Novice Hunter",
    subtitle: "Awakened Novice",
    color: "hsl(215, 16%, 47%)",
    minExp: 0,
    maxExp: 500,
    minWeeklyHours: 0,
    minDailyAvgHours: 0,
    gateMarksMin: 0,
    gateMarksMax: 25,
    predictedAir: "Below Cutoff (Unranked)",
    collegeProspects: "Foundational phase • Build core concepts & syllabus stamina",
    description: "Every Monarch started as the weakest hunter. Begin your awakening.",
    quote: "I am an E-Rank hunter. But I will not stay weak.",
  },
  {
    name: "D",
    title: "Learner Hunter",
    subtitle: "Dungeon Survivor",
    color: "hsl(221, 83%, 53%)",
    minExp: 500,
    maxExp: 1500,
    minWeeklyHours: 10.5,
    minDailyAvgHours: 1.5,
    gateMarksMin: 25,
    gateMarksMax: 32,
    predictedAir: "AIR 15,000 – 30,000",
    collegeProspects: "Borderline Qualifying Cutoff (~25 to 28 marks threshold)",
    description: "Building foundational stamina with 1.5h daily consistent study sessions.",
    quote: "Surviving the double dungeon requires focus, endurance, and persistence.",
  },
  {
    name: "C",
    title: "Striker Hunter",
    subtitle: "Raid Specialist",
    color: "hsl(221, 83%, 53%)",
    minExp: 1500,
    maxExp: 3000,
    minWeeklyHours: 21.0,
    minDailyAvgHours: 3.0,
    gateMarksMin: 32,
    gateMarksMax: 40,
    predictedAir: "AIR 7,000 – 15,000",
    collegeProspects: "GATE Qualified! Margin above general cutoff • State Engineering Colleges",
    description: "Solid conceptual command and steady 3h daily double-digit weekly hours.",
    quote: "The mana coursing through you is now undeniable. Keep attacking weaknesses.",
  },
  {
    name: "B",
    title: "Elite Scholar",
    subtitle: "High Raid Veteran",
    color: "hsl(221, 83%, 53%)",
    minExp: 3000,
    maxExp: 5000,
    minWeeklyHours: 31.5,
    minDailyAvgHours: 4.5,
    gateMarksMin: 40,
    gateMarksMax: 50,
    predictedAir: "AIR 3,000 – 7,000",
    collegeProspects: "NITs, IIITs (Allahabad/Bangalore), State Top Engineering Institutions",
    description: "Disciplined study routine holding firm at 4.5h daily across major subjects.",
    quote: "You are no longer ordinary. The gates yield to your daily discipline.",
  },
  {
    name: "A",
    title: "High Hunter",
    subtitle: "Guild Champion",
    color: "hsl(221, 83%, 53%)",
    minExp: 5000,
    maxExp: 7500,
    minWeeklyHours: 42.0,
    minDailyAvgHours: 6.0,
    gateMarksMin: 50,
    gateMarksMax: 60,
    predictedAir: "AIR 1,000 – 3,000",
    collegeProspects: "Top NITs (Trichy/Surathkal/Warangal), Newer IITs, BITS Pilani M.Tech",
    description: "Deep conceptual command and elite 6h daily endurance under pressure.",
    quote: "A-Rank presence. The Association takes notice of your relentless grind.",
  },
  {
    name: "S",
    title: "Shadow Sovereign",
    subtitle: "National Striker",
    color: "hsl(221, 83%, 53%)",
    minExp: 7500,
    maxExp: 11000,
    minWeeklyHours: 56.0,
    minDailyAvgHours: 8.0,
    gateMarksMin: 60,
    gateMarksMax: 70,
    predictedAir: "AIR 300 – 1,000",
    collegeProspects: "Old IITs (Roorkee/Guwahati/KGP), Top NITs, IIIT Hyderabad",
    description: "Commanding 8-hour daily stamina, mastering numerical solving and accuracy under time crunch.",
    quote: "The shadows heed your call. You stand at the threshold of the national vanguard.",
  },
  {
    name: "SS",
    title: "National Hunter",
    subtitle: "Ruler's Vessel",
    color: "hsl(262, 83%, 58%)",
    minExp: 11000,
    maxExp: 16000,
    minWeeklyHours: 70.0,
    minDailyAvgHours: 10.0,
    gateMarksMin: 70,
    gateMarksMax: 80,
    predictedAir: "AIR 50 – 300",
    collegeProspects: "Top 5 Old IITs (Madras/Delhi/Kanpur/Bombay/KGP) direct M.Tech & PSU Top Call",
    description: "Phenomenal double-digit daily study commitment and flawless command of syllabus.",
    quote: "Ruler's Authority active. The highest academic pinnacles bow before your discipline.",
  },
  {
    name: "SSS",
    title: "Shadow Monarch",
    subtitle: "Monarch of Shadows",
    color: "hsl(43, 96%, 56%)",
    minExp: 16000,
    maxExp: 999999,
    minWeeklyHours: 84.0,
    minDailyAvgHours: 12.0,
    gateMarksMin: 80,
    gateMarksMax: 100,
    predictedAir: "AIR 1 – 50 (Single Digit AIR Contender)",
    collegeProspects: "IISc Bangalore CSA, IIT Bombay CS, Highest PSU Direct Absorption",
    description: "Absolute mastery over time, memory, and GATE syllabus. Total preparation sovereignty.",
    quote: "ARISE. The entire national examination hierarchy is within your grasp.",
  },
]

export function calculateWeeklyStudyStats(
  reports: Array<{ date?: string; report_date?: string; practiceHours?: number; practice_hours?: number; lecturesCompleted?: number; lectures_completed?: number }>,
  referenceDate: Date = new Date(),
): WeeklyStudyStats {
  const rollingStart = subDays(referenceDate, 6)
  const rollingEnd = referenceDate

  const calStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const calEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })

  let rollingHours = 0
  let calendarHours = 0
  let activeDays7 = 0

  for (const r of reports) {
    const rawDate = r.date || r.report_date
    if (!rawDate) continue

    const d = new Date(rawDate + "T00:00:00")
    if (isNaN(d.getTime())) continue

    const hrs = Number(r.practiceHours ?? r.practice_hours ?? 0)
    const lecs = Number(r.lecturesCompleted ?? r.lectures_completed ?? 0)
    const totalEffectiveHours = hrs + lecs * 1.5

    if (isWithinInterval(d, { start: rollingStart, end: rollingEnd })) {
      rollingHours += totalEffectiveHours
      if (totalEffectiveHours > 0) activeDays7++
    }

    if (isWithinInterval(d, { start: calStart, end: calEnd })) {
      calendarHours += totalEffectiveHours
    }
  }

  rollingHours = Number(rollingHours.toFixed(1))
  calendarHours = Number(calendarHours.toFixed(1))
  const dailyAvg = Number((rollingHours / 7).toFixed(1))
  const effectiveWeeklyHours = Math.max(rollingHours, calendarHours)

  return {
    rolling7DaysHours: rollingHours,
    calendarWeekHours: calendarHours,
    dailyAvgHours: dailyAvg,
    effectiveWeeklyHours,
    activeDays7,
  }
}

export function getRank(exp: number, weeklyHours: number): RankInfo {
  const safeExp = Math.max(0, exp || 0)
  const safeHours = Math.max(0, weeklyHours || 0)

  for (let i = RANKS.length - 1; i >= 0; i--) {
    const rank = RANKS[i]
    if (safeExp >= rank.minExp && safeHours >= rank.minWeeklyHours) {
      return rank
    }
  }

  return RANKS[0]
}

export function getNextRank(currentRankName: RankName): RankInfo | null {
  const idx = RANKS.findIndex((r) => r.name === currentRankName)
  if (idx === -1 || idx === RANKS.length - 1) return null
  return RANKS[idx + 1]
}

export interface RankProgressDetails {
  expProgress: number
  timeProgress: number
  overallProgress: number
  expNeeded: number
  hoursNeeded: number
  isTimeGated: boolean
  isExpGated: boolean
  canUpgrade: boolean
}

export function getRankProgressDetails(
  exp: number,
  weeklyHours: number,
  currentRank: RankInfo,
  nextRank: RankInfo | null,
): RankProgressDetails {
  if (!nextRank) {
    return {
      expProgress: 100,
      timeProgress: 100,
      overallProgress: 100,
      expNeeded: 0,
      hoursNeeded: 0,
      isTimeGated: false,
      isExpGated: false,
      canUpgrade: false,
    }
  }

  const expSpan = nextRank.minExp - currentRank.minExp
  const expProgress =
    expSpan > 0
      ? Math.min(100, Math.max(0, ((exp - currentRank.minExp) / expSpan) * 100))
      : 100

  const timeSpan = nextRank.minWeeklyHours - currentRank.minWeeklyHours
  const timeProgress =
    timeSpan > 0
      ? Math.min(100, Math.max(0, ((weeklyHours - currentRank.minWeeklyHours) / timeSpan) * 100))
      : 100

  const expNeeded = Math.max(0, nextRank.minExp - exp)
  const hoursNeeded = Math.max(0, Number((nextRank.minWeeklyHours - weeklyHours).toFixed(1)))

  const isTimeGated = exp >= nextRank.minExp && weeklyHours < nextRank.minWeeklyHours
  const isExpGated = weeklyHours >= nextRank.minWeeklyHours && exp < nextRank.minExp
  const canUpgrade = exp >= nextRank.minExp && weeklyHours >= nextRank.minWeeklyHours
  const overallProgress = Math.min(100, Math.round(expProgress * 0.5 + timeProgress * 0.5))

  return {
    expProgress: Math.round(expProgress),
    timeProgress: Math.round(timeProgress),
    overallProgress,
    expNeeded,
    hoursNeeded,
    isTimeGated,
    isExpGated,
    canUpgrade,
  }
}

export function predictBaseGateScore(exp: number, weeklyHours: number): {
  predictedScore: number
  scoreMin: number
  scoreMax: number
  rank: RankInfo
  airBand: string
  prospects: string
} {
  const currentRank = getRank(exp, weeklyHours)
  const nextRank = getNextRank(currentRank.name)
  const progressDetails = getRankProgressDetails(exp, weeklyHours, currentRank, nextRank)

  const span = currentRank.gateMarksMax - currentRank.gateMarksMin
  const fractional = (progressDetails.overallProgress / 100) * span
  const rawScore = currentRank.gateMarksMin + fractional
  const predictedScore = Number(Math.min(100, Math.max(0, rawScore)).toFixed(1))

  return {
    predictedScore,
    scoreMin: currentRank.gateMarksMin,
    scoreMax: currentRank.gateMarksMax,
    rank: currentRank,
    airBand: currentRank.predictedAir,
    prospects: currentRank.collegeProspects,
  }
}

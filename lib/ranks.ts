import { isWithinInterval, startOfWeek, endOfWeek, subDays } from "date-fns"

export type RankName = "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS"

export interface ThemeOption {
  name: string
  value: string
  color: string // HSL format e.g. "hsl(221, 83%, 53%)"
}

export type RankTheme = ThemeOption

export const THEMES: ThemeOption[] = [
  { name: "Blue", value: "blue", color: "hsl(221, 83%, 53%)" },
  { name: "Green", value: "green", color: "hsl(142, 76%, 36%)" },
  { name: "Purple", value: "purple", color: "hsl(262, 83%, 58%)" },
  { name: "Orange", value: "orange", color: "hsl(25, 95%, 53%)" },
  { name: "Red", value: "red", color: "hsl(0, 84%, 60%)" },
  { name: "Pink", value: "pink", color: "hsl(336, 75%, 40%)" },
]

export const ALL_THEMES: ThemeOption[] = THEMES

export interface RankInfo {
  name: RankName
  title: string
  subtitle: string
  color: string
  minExp: number
  maxExp: number
  /** Minimum average weekly study hours required to hold or achieve this rank */
  minWeeklyHours: number
  /** Daily average study time in hours required over the week */
  minDailyAvgHours: number
  /** GATE Marks Predictor: minimum expected marks (0 to 100 scale) */
  gateMarksMin: number
  /** GATE Marks Predictor: maximum expected marks (0 to 100 scale) */
  gateMarksMax: number
  /** Predicted All India Rank (AIR) band */
  predictedAir: string
  /** Target opportunities / institutions for this mark band */
  collegeProspects: string
  description: string
  quote: string
}

export const RANKS: RankInfo[] = [
  {
    name: "E",
    title: "Novice Hunter",
    subtitle: "Awakened Novice",
    color: "hsl(var(--muted-foreground))",
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
    color: "hsl(var(--primary))",
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
    color: "hsl(var(--primary))",
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
    color: "hsl(var(--primary))",
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
    color: "hsl(var(--primary))",
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
    color: "hsl(var(--primary))",
    minExp: 7500,
    maxExp: 11000,
    minWeeklyHours: 56.0,
    minDailyAvgHours: 8.0,
    gateMarksMin: 60,
    gateMarksMax: 70,
    predictedAir: "AIR 300 – 1,000",
    collegeProspects: "Old IITs (Roorkee/Guwahati/KGP), Top NITs, IIIT Hyderabad",
    description: "Commanding 8-hour daily stamina. Ascending beyond ordinary hunters into sovereign preparation authority.",
    quote: "The system chose you for a reason. Command your focus like an army.",
  },
  {
    name: "SS",
    title: "National Rank Hunter",
    subtitle: "Pinnacle Gatekeeper",
    color: "hsl(var(--primary))",
    minExp: 11000,
    maxExp: 16000,
    minWeeklyHours: 70.0,
    minDailyAvgHours: 10.0,
    gateMarksMin: 70,
    gateMarksMax: 80,
    predictedAir: "AIR 50 – 300",
    collegeProspects: "Top 5 Old IITs (Bombay/Delhi/Madras/Kanpur) Direct M.Tech & PSU Shortlist",
    description: "Legendary 10-hour daily output ranking among the top elite percentile nationwide.",
    quote: "At this summit, few can match your weekly stamina and conceptual depth.",
  },
  {
    name: "SSS",
    title: "Shadow Monarch",
    subtitle: "Absolute Sovereign",
    color: "hsl(var(--primary))",
    minExp: 16000,
    maxExp: 25000,
    minWeeklyHours: 84.0,
    minDailyAvgHours: 12.0,
    gateMarksMin: 80,
    gateMarksMax: 100,
    predictedAir: "AIR 1 – 50 (All-India Topper)",
    collegeProspects: "Guaranteed IISc Bangalore CSA, IIT Bombay CS, Maharatna PSU (ONGC/IOCL) Top Ranker",
    description: "Absolute 12-hour daily mastery over GATE preparation. Arise and conquer.",
    quote: "ARISE. The Monarch of preparation bows to no question paper.",
  },
]

export interface WeeklyStudyStats {
  rolling7DaysHours: number
  calendarWeekHours: number
  dailyAvgHours: number
  effectiveWeeklyHours: number
  activeDays7: number
}

/**
 * Calculates study time metrics for rank calculations.
 */
export function calculateWeeklyStudyStats(
  dailyReports: Array<{ date: Date | string; practiceHours?: number; lecturesCompleted?: number }>,
): WeeklyStudyStats {
  const now = new Date()
  const windowStart = subDays(now, 7)
  const windowEnd = now

  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  let rollingHours = 0
  let calendarHours = 0
  let activeDays7 = 0

  dailyReports.forEach((report) => {
    const reportDate = typeof report.date === "string" ? new Date(report.date) : report.date
    if (isNaN(reportDate.getTime())) return

    const hours = Number(report.practiceHours || 0)

    if (isWithinInterval(reportDate, { start: windowStart, end: windowEnd })) {
      rollingHours += hours
      if (hours > 0 || (report.lecturesCompleted && report.lecturesCompleted > 0)) {
        activeDays7++
      }
    }

    if (isWithinInterval(reportDate, { start: weekStart, end: weekEnd })) {
      calendarHours += hours
    }
  })

  rollingHours = Number(rollingHours.toFixed(1))
  calendarHours = Number(calendarHours.toFixed(1))

  // Daily average over the 7-day rolling window
  const dailyAvg = Number((rollingHours / 7).toFixed(1))

  // Effective weekly hours: best of rolling 7 days or calendar week pace
  const effectiveWeeklyHours = Math.max(rollingHours, calendarHours)

  return {
    rolling7DaysHours: rollingHours,
    calendarWeekHours: calendarHours,
    dailyAvgHours: dailyAvg,
    effectiveWeeklyHours,
    activeDays7,
  }
}

/**
 * Determines a user's rank based on BOTH their EXP and their weekly study hours.
 * If a user has points but not enough weekly study hours, their rank is gated by their
 * weekly study consistency!
 */
export function getRank(exp: number, weeklyHours: number): RankInfo {
  const safeExp = Math.max(0, exp || 0)
  const safeHours = Math.max(0, weeklyHours || 0)

  // Start from the top (SSS) down to E
  for (let i = RANKS.length - 1; i >= 0; i--) {
    const rank = RANKS[i]
    if (safeExp >= rank.minExp && safeHours >= rank.minWeeklyHours) {
      return rank
    }
  }

  return RANKS[0] // Novice E-Rank
}

/**
 * Get next rank above current
 */
export function getNextRank(currentRankName: RankName): RankInfo | null {
  const idx = RANKS.findIndex((r) => r.name === currentRankName)
  if (idx === -1 || idx === RANKS.length - 1) return null
  return RANKS[idx + 1]
}

export interface RankProgressDetails {
  expProgress: number // 0 - 100
  timeProgress: number // 0 - 100
  overallProgress: number // 0 - 100
  expNeeded: number
  hoursNeeded: number
  isTimeGated: boolean
  isExpGated: boolean
  canUpgrade: boolean
}

/**
 * Calculate progress toward next rank, taking both EXP and weekly hours into account.
 */
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
      ? Math.min(
          100,
          Math.max(0, ((weeklyHours - currentRank.minWeeklyHours) / timeSpan) * 100),
        )
      : 100

  const expNeeded = Math.max(0, nextRank.minExp - exp)
  const hoursNeeded = Math.max(0, Number((nextRank.minWeeklyHours - weeklyHours).toFixed(1)))

  const isTimeGated = exp >= nextRank.minExp && weeklyHours < nextRank.minWeeklyHours
  const isExpGated = weeklyHours >= nextRank.minWeeklyHours && exp < nextRank.minExp
  const canUpgrade = exp >= nextRank.minExp && weeklyHours >= nextRank.minWeeklyHours

  // Composite progress reflects both requirements
  const overallProgress = Math.min(100, Math.round((expProgress * 0.5) + (timeProgress * 0.5)))

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

/**
 * Backward compatibility: All color themes are unlocked.
 */
export function isThemeUnlocked(
  _themeValue: string,
  _userRankName?: RankName,
  _highestRankName?: RankName,
  _unlockedCosmetics: string[] = [],
): boolean {
  return true
}

/**
 * Returns GATE Marks Predictor details for a specific rank.
 */
export function getRankGateMarks(rankName: RankName) {
  const rank = RANKS.find((r) => r.name === rankName) || RANKS[0]
  return {
    rank: rank.name,
    minMarks: rank.gateMarksMin,
    maxMarks: rank.gateMarksMax,
    predictedAir: rank.predictedAir,
    collegeProspects: rank.collegeProspects,
  }
}

/**
 * Computes an estimated base GATE score (0-100) from EXP and weekly consistency.
 * SSS: 80 - 100 marks
 * SS:  70 - 80 marks
 * S:   60 - 70 marks
 * A:   50 - 60 marks
 * B:   40 - 50 marks
 * C:   32 - 40 marks
 * D:   25 - 32 marks
 * E:    0 - 25 marks
 */
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

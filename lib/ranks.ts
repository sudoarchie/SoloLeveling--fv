import { subDays, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns"

export type RankName = "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS"

export interface RankTheme {
  name: string
  value: string
  color: string // HSL format e.g. "hsl(221, 83%, 53%)"
  glowColor: string
  requiredRank: RankName
  description: string
}

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
  description: string
  quote: string
  theme: RankTheme
}

export const RANK_THEMES: Record<RankName, RankTheme> = {
  E: {
    name: "Hunter Blue",
    value: "blue",
    color: "hsl(221, 83%, 53%)",
    glowColor: "rgba(59, 130, 246, 0.5)",
    requiredRank: "E",
    description: "The baseline mana hue of every awakened hunter.",
  },
  D: {
    name: "Emerald Gate",
    value: "green",
    color: "hsl(142, 76%, 36%)",
    glowColor: "rgba(34, 197, 94, 0.5)",
    requiredRank: "D",
    description: "Vitality radiating from consistent daily dungeon training.",
  },
  C: {
    name: "Amethyst Mana",
    value: "purple",
    color: "hsl(262, 83%, 58%)",
    glowColor: "rgba(168, 85, 247, 0.5)",
    requiredRank: "C",
    description: "Concentrated arcane force earned through dedicated weekly problem practice.",
  },
  B: {
    name: "Solar Radiance",
    value: "orange",
    color: "hsl(25, 95%, 53%)",
    glowColor: "rgba(249, 115, 22, 0.5)",
    requiredRank: "B",
    description: "Burning high-output discipline holding strong week after week.",
  },
  A: {
    name: "Blood Crimson",
    value: "red",
    color: "hsl(0, 84%, 60%)",
    glowColor: "rgba(239, 68, 68, 0.5)",
    requiredRank: "A",
    description: "Aggressive battle aura of elite high-tier dungeon strikers.",
  },
  S: {
    name: "Sakura Neon",
    value: "pink",
    color: "hsl(336, 75%, 48%)",
    glowColor: "rgba(236, 72, 153, 0.5)",
    requiredRank: "S",
    description: "Pure S-Rank mana crystallization. Elite national hunter presence.",
  },
  SS: {
    name: "Shadow Azure",
    value: "cyan",
    color: "hsl(189, 94%, 43%)",
    glowColor: "rgba(6, 182, 212, 0.5)",
    requiredRank: "SS",
    description: "Luminescent sovereign power. The apex domain before coronation.",
  },
  SSS: {
    name: "Abyssal Monarch",
    value: "gold",
    color: "hsl(45, 93%, 47%)",
    glowColor: "rgba(234, 179, 8, 0.6)",
    requiredRank: "SSS",
    description: "The golden aura of the Shadow Monarch. Absolute mastery over preparation.",
  },
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
    description: "Every Monarch started as the weakest hunter. Begin your awakening.",
    quote: "I am an E-Rank hunter. But I will not stay weak.",
    theme: RANK_THEMES.E,
  },
  {
    name: "D",
    title: "Learner Hunter",
    subtitle: "Dungeon Survivor",
    color: "hsl(142, 76%, 36%)",
    minExp: 500,
    maxExp: 1200,
    minWeeklyHours: 5.0,
    minDailyAvgHours: 0.7,
    description: "Building foundational stamina with consistent weekly study sessions.",
    quote: "Surviving the double dungeon requires focus, endurance, and persistence.",
    theme: RANK_THEMES.D,
  },
  {
    name: "C",
    title: "Striker Hunter",
    subtitle: "Raid Specialist",
    color: "hsl(262, 83%, 58%)",
    minExp: 1200,
    maxExp: 2000,
    minWeeklyHours: 10.0,
    minDailyAvgHours: 1.4,
    description: "Solid conceptual command and steady double-digit weekly hours.",
    quote: "The mana coursing through you is now undeniable. Keep attacking weaknesses.",
    theme: RANK_THEMES.C,
  },
  {
    name: "B",
    title: "Elite Scholar",
    subtitle: "High Raid Veteran",
    color: "hsl(25, 95%, 53%)",
    minExp: 2000,
    maxExp: 3000,
    minWeeklyHours: 16.0,
    minDailyAvgHours: 2.3,
    description: "Disciplined study routine holding firm across major subjects.",
    quote: "You are no longer ordinary. The gates yield to your daily discipline.",
    theme: RANK_THEMES.B,
  },
  {
    name: "A",
    title: "High Hunter",
    subtitle: "Guild Champion",
    color: "hsl(0, 84%, 60%)",
    minExp: 3000,
    maxExp: 4500,
    minWeeklyHours: 24.0,
    minDailyAvgHours: 3.4,
    description: "Deep conceptual command and elite weekly endurance under pressure.",
    quote: "A-Rank presence. The Association takes notice of your relentless grind.",
    theme: RANK_THEMES.A,
  },
  {
    name: "S",
    title: "National Hunter",
    subtitle: "Living Legend",
    color: "hsl(336, 75%, 48%)",
    minExp: 4500,
    maxExp: 6500,
    minWeeklyHours: 32.0,
    minDailyAvgHours: 4.6,
    description: "Elite top-tier performance unmatched by ordinary students.",
    quote: "Your power bends the curve. Top percentile rank is within reach.",
    theme: RANK_THEMES.S,
  },
  {
    name: "SS",
    title: "Monarch Candidate",
    subtitle: "Apex Sovereign",
    color: "hsl(189, 94%, 43%)",
    minExp: 6500,
    maxExp: 9000,
    minWeeklyHours: 40.0,
    minDailyAvgHours: 5.7,
    description: "Top 1% discipline. Deep work is your second nature every single day.",
    quote: "The shadows whisper your name. Sovereign awakening is at hand.",
    theme: RANK_THEMES.SS,
  },
  {
    name: "SSS",
    title: "Shadow Monarch",
    subtitle: "Ruler of Shadows",
    color: "hsl(45, 93%, 47%)",
    minExp: 9000,
    maxExp: 15000,
    minWeeklyHours: 48.0,
    minDailyAvgHours: 6.9,
    description: "Complete domain expansion. The absolute pinnacle of preparation.",
    quote: "ARISE. The highest rank has been attained.",
    theme: RANK_THEMES.SSS,
  },
]

export const ALL_THEMES: RankTheme[] = Object.values(RANK_THEMES)

export interface WeeklyStudyStats {
  /** Sum of study hours in the rolling 7-day window */
  rolling7DaysHours: number
  /** Sum of study hours in the current calendar week */
  calendarWeekHours: number
  /** Daily average over the rolling 7-day window (hours/day) */
  dailyAvgHours: number
  /** Effective weekly study hours used for rank calculation */
  effectiveWeeklyHours: number
  /** Number of active study days in the rolling 7-day window */
  activeDays7: number
}

/**
 * Calculates rolling weekly study time and daily average from daily reports.
 */
export function calculateWeeklyStudyStats(
  reports: Array<{
    date: Date | string
    practiceHours?: number
    lecturesCompleted?: number
  }>,
  referenceDate: Date = new Date(),
): WeeklyStudyStats {
  const windowStart = startOfDay(subDays(referenceDate, 6))
  const windowEnd = endOfDay(referenceDate)
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })

  let rollingHours = 0
  let activeDays7 = 0
  let calendarHours = 0

  reports.forEach((report) => {
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
 * Check if a specific color theme is unlocked for a user.
 * A theme is unlocked if:
 * 1. It is the base theme ('blue')
 * 2. Or user has reached or exceeded the required rank
 * 3. Or it has been awarded in `unlockedCosmetics`
 */
export function isThemeUnlocked(
  themeValue: string,
  userRankName: RankName,
  highestRankName?: RankName,
  unlockedCosmetics: string[] = [],
): boolean {
  if (themeValue === "blue") return true
  if (unlockedCosmetics.includes(themeValue)) return true

  const theme = ALL_THEMES.find((t) => t.value === themeValue)
  if (!theme) return false

  const themeRankIndex = RANKS.findIndex((r) => r.name === theme.requiredRank)
  const userRankIndex = RANKS.findIndex((r) => r.name === userRankName)
  const highestRankIndex = highestRankName
    ? RANKS.findIndex((r) => r.name === highestRankName)
    : -1

  const effectiveRankIndex = Math.max(userRankIndex, highestRankIndex)
  return effectiveRankIndex >= themeRankIndex
}

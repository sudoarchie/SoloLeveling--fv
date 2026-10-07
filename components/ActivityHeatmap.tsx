"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Grid3x3, Flame } from "lucide-react"
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getMonth,
} from "date-fns"

interface HeatmapDay {
  date: Date
  exp: number
  level: 0 | 1 | 2 | 3 | 4
}

interface ActivityHeatmapProps {
  dailyReports: { date: Date; expGained: number }[]
  weeks?: number
}

// EXP thresholds per intensity level
const LEVEL_THRESHOLDS = [1, 80, 160, 280] // min EXP for levels 1-4
const LEVEL_COLORS = [
  "bg-muted", // level 0 — no study
  "bg-primary/20", // level 1 — light
  "bg-primary/40", // level 2 — moderate
  "bg-primary/65", // level 3 — strong
  "bg-primary", // level 4 — intense (glowing)
]

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function getLevel(exp: number): HeatmapDay["level"] {
  if (exp <= 0) return 0
  if (exp < LEVEL_THRESHOLDS[1]) return 1
  if (exp < LEVEL_THRESHOLDS[2]) return 2
  if (exp < LEVEL_THRESHOLDS[3]) return 3
  return 4
}

const CELL = 14 // px
const GAP = 3 // px
const LABEL_COL = 30 // px, day-of-week gutter

export function ActivityHeatmap({
  dailyReports,
  weeks = 26,
}: ActivityHeatmapProps) {
  const { grid, monthLabels, totalExp, activeDays, bestDay } = useMemo(() => {
    // Map reports by date string for O(1) lookup
    const expByDate = new Map<string, number>()
    for (const r of dailyReports) {
      const key = format(r.date, "yyyy-MM-dd")
      expByDate.set(key, (expByDate.get(key) ?? 0) + r.expGained)
    }

    // Build grid: columns = weeks, rows = days of week (Sun-Sat)
    const end = endOfWeek(new Date())
    const start = startOfWeek(subDays(end, (weeks - 1) * 7))
    const days = eachDayOfInterval({ start, end })

    const grid: HeatmapDay[][] = []
    let currentWeek: HeatmapDay[] = []
    const monthLabels: { col: number; label: string }[] = []
    let lastMonth = -1

    days.forEach((date) => {
      const key = format(date, "yyyy-MM-dd")
      const exp = expByDate.get(key) ?? 0

      // Label a column when its Sunday starts a new month
      const month = getMonth(date)
      if (date.getDay() === 0 && month !== lastMonth) {
        monthLabels.push({ col: grid.length, label: MONTH_LABELS[month] })
        lastMonth = month
      }

      currentWeek.push({ date, exp, level: getLevel(exp) })

      if (currentWeek.length === 7) {
        grid.push(currentWeek)
        currentWeek = []
      }
    })
    if (currentWeek.length > 0) grid.push(currentWeek)

    // Stats
    let totalExp = 0
    let activeDays = 0
    let bestDay = { exp: 0, date: new Date() }
    expByDate.forEach((exp, key) => {
      totalExp += exp
      if (exp > 0) activeDays++
      if (exp > bestDay.exp) {
        bestDay = { exp, date: new Date(key) }
      }
    })

    return { grid, monthLabels, totalExp, activeDays, bestDay }
  }, [dailyReports, weeks])

  const longestRun = useMemo(() => {
    // Longest consecutive active-day run within the heatmap window
    let run = 0
    let max = 0
    for (const week of grid) {
      for (const day of week) {
        if (day.exp > 0) {
          run++
          max = Math.max(max, run)
        } else {
          run = 0
        }
      }
    }
    return max
  }, [grid])

  const labelColWidth = LABEL_COL // px, day-label gutter

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" />
            Recent study activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Flame className="h-3 w-3 text-orange-400" />
              {activeDays} active {activeDays === 1 ? "day" : "days"}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {totalExp.toLocaleString()} EXP
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex flex-col min-w-max">
              {/* Month labels — absolutely positioned over their grid columns */}
              <div
                className="relative h-4"
                style={{
                  marginLeft: labelColWidth,
                  width: grid.length * (CELL + GAP),
                }}
              >
                {monthLabels.map(({ col, label }) => (
                  <span
                    key={`${col}-${label}`}
                    className="absolute top-0 text-[9px] leading-4 text-muted-foreground whitespace-nowrap"
                    style={{ left: col * (CELL + GAP) }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Day rows */}
              <div className="flex gap-[3px]">
                {/* Day-of-week labels — fixed gutter, rows vertically centered */}
                <div
                  className="flex flex-col justify-around text-[9px] leading-none text-muted-foreground shrink-0"
                  style={{ width: labelColWidth - GAP, height: 7 * CELL + 6 * GAP }}
                >
                  <span />
                  <span>Mon</span>
                  <span />
                  <span>Wed</span>
                  <span />
                  <span>Fri</span>
                  <span />
                </div>

                {/* Grid columns (weeks) */}
                {grid.map((week, col) => (
                  <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((day, row) => (
                      <Tooltip key={row}>
                        <TooltipTrigger asChild>
                          <div
                            className={`rounded-[3px] ${LEVEL_COLORS[day.level]} ${
                              day.level === 0
                                ? ""
                                : "cursor-pointer hover:ring-1 hover:ring-foreground/40"
                            }`}
                            style={{ width: CELL, height: CELL }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-semibold">
                            {format(day.date, "EEE, MMM d, yyyy")}
                          </p>
                          <p className="text-muted-foreground">
                            {day.exp > 0
                              ? `+${day.exp.toLocaleString()} EXP earned`
                              : "No study logged"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TooltipProvider>

        {/* Legend + stats */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Less</span>
            {LEVEL_COLORS.map((color, i) => (
              <div
                key={i}
                className={`w-[11px] h-[11px] rounded-[2px] ${color}`}
              />
            ))}
            <span>More</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {longestRun > 0 && (
              <>
                longest streak:{" "}
                <span className="text-primary font-medium">{longestRun}d</span> •{" "}
              </>
            )}
            best day:{" "}
            <span className="text-primary font-medium">
              +{bestDay.exp.toLocaleString()} EXP
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

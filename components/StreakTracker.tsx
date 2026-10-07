"use client"

import { Flame, Snowflake } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { StreakData } from "@/hooks/useDailyQuests"

const MILESTONES = [3, 7, 14, 30, 60, 100]

export function StreakTracker({ streak }: { streak: StreakData }) {
  const next = MILESTONES.find((days) => days > streak.currentStreak)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          Consistency
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-8">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {streak.currentStreak}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                days
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Current streak</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {streak.longestStreak}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                days
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Personal best</p>
          </div>
        </div>
        {next && (
          <div className="mt-6">
            <Progress
              value={(streak.currentStreak / next) * 100}
              aria-label="Progress to next streak milestone"
              className="h-1.5"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {next - streak.currentStreak} more{" "}
              {next - streak.currentStreak === 1 ? "day" : "days"} to your{" "}
              {next}-day milestone.
            </p>
          </div>
        )}
        {streak.streakFreezes > 0 && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Snowflake className="h-3.5 w-3.5" />
            {streak.streakFreezes} streak{" "}
            {streak.streakFreezes === 1 ? "freeze" : "freezes"} available
          </p>
        )}
      </CardContent>
    </Card>
  )
}

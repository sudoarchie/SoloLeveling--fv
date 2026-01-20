'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Zap, TrendingUp, Award, Flame, Target, Brain } from 'lucide-react'

interface GamificationStatsProps {
  streak: number
  totalExp: number
  perfectDays: number
  bestStreak: number
  variableRewards: number[]
}

export default function GamificationStats({
  streak,
  totalExp,
  perfectDays,
  bestStreak,
  variableRewards,
}: GamificationStatsProps) {
  // Calculate psychological metrics
  const consistencyScore = Math.min(100, (streak / bestStreak) * 100) || 0
  const gamificationLevel = Math.floor(totalExp / 500) + 1
  const nextLevelProgress = ((totalExp % 500) / 500) * 100

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Streak Card - Psychological hook: Loss aversion */}
      <Card className="bg-gradient-to-br from-orange-900/40 to-red-900/40 border-orange-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Current Streak</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{streak}</p>
              <p className="text-xs text-gray-500 mt-1">days in a row</p>
              <p className="text-xs text-yellow-400 mt-2">Best: {bestStreak} days</p>
            </div>
            <Flame className="w-12 h-12 text-orange-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      {/* Gamification Level - Variable rewards */}
      <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-cyan-500/30">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Gamer Level</p>
              <Badge className="bg-cyan-600">{gamificationLevel}</Badge>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{totalExp}</p>
            <p className="text-xs text-gray-500">Total Gamification Points</p>
            <Progress value={nextLevelProgress} className="h-2" />
            <p className="text-xs text-cyan-300">
              {Math.floor(nextLevelProgress)}% to next level
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Perfect Days - Achievement motivation */}
      <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Perfect Days</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{perfectDays}</p>
              <p className="text-xs text-gray-500 mt-1">100% goal completion</p>
            </div>
            <Target className="w-12 h-12 text-green-500 opacity-30" />
          </div>
        </CardContent>
      </Card>

      {/* Consistency Score - Psychological: social proof */}
      <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Consistency</p>
              <span className="text-2xl font-bold text-purple-400">
                {Math.round(consistencyScore)}%
              </span>
            </div>
            <Progress value={consistencyScore} className="h-2" />
            <p className="text-xs text-gray-500">
              {consistencyScore >= 80
                ? '🔥 Elite consistency! Keep it up!'
                : consistencyScore >= 60
                  ? '💪 Good momentum, don\'t break it!'
                  : '⚠️ Build your streak back up!'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Variable Rewards - Dopamine hit */}
      <Card className="bg-gradient-to-br from-yellow-900/40 to-amber-900/40 border-yellow-500/30">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Bonus Streak</p>
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {variableRewards.length}x
            </p>
            <p className="text-xs text-gray-500">
              Unpredictable bonuses - surprise yourself!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border-indigo-500/30">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <p className="text-xs text-gray-400 uppercase">Psychology</p>
            </div>
            <p className="text-sm text-indigo-300 mt-2">
              {streak >= 7 ? (
                <>
                  <span className="font-bold">Habit Formed!</span>
                  <br />
                  Your brain is creating neural pathways
                </>
              ) : streak >= 3 ? (
                <>
                  <span className="font-bold">Building Momentum</span>
                  <br />
                  4+ days to form habit
                </>
              ) : (
                <>
                  <span className="font-bold">Starting Strong</span>
                  <br />
                  Each day counts toward habit formation
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

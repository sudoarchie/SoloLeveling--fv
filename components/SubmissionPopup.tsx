"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { X, Crown, Zap, Clock, TrendingUp, Target } from "lucide-react"

interface RankInfo {
  name: string
  fullName: string
  color: string
  glowColor: string
  minExp: number
  maxExp: number
  mentalState: string
}

interface SubmissionPopupProps {
  isOpen: boolean
  onClose: () => void
  currentRank: RankInfo
  currentExp: number
  expGained: number
  daysRemaining: number
  averageExpPerDay: number
  daysToNextRank: number | null
  nextRank: RankInfo | null
}

export function SubmissionPopup({
  isOpen,
  onClose,
  currentRank,
  currentExp,
  expGained,
  daysRemaining,
  averageExpPerDay,
  daysToNextRank,
  nextRank,
}: SubmissionPopupProps) {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowContent(true)
    } else {
      setShowContent(false)
    }
  }, [isOpen])

  const getExpProgress = () => {
    const progress = ((currentExp - currentRank.minExp) / (currentRank.maxExp - currentRank.minExp)) * 100
    return Math.min(100, Math.max(0, progress))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={`transform transition-all duration-500 ${
          showContent ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <Card className="bg-gray-900/95 border-gray-700 backdrop-blur-sm w-[500px] max-w-[90vw] relative overflow-hidden">
          {/* Animated background glow */}
          <div
            className="absolute inset-0 opacity-20 animate-pulse"
            style={{
              background: `radial-gradient(circle at center, ${currentRank.glowColor}20 0%, transparent 70%)`,
            }}
          />

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>

          <CardContent className="p-8 relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center mb-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-4 relative animate-pulse"
                  style={{
                    backgroundColor: currentRank.color,
                    borderColor: currentRank.glowColor,
                    boxShadow: `0 0 30px ${currentRank.glowColor}60`,
                  }}
                >
                  {currentRank.name}
                  <div
                    className="absolute -inset-2 rounded-full animate-ping border-2"
                    style={{ borderColor: currentRank.glowColor }}
                  />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Hunter Report Submitted!</h2>
              <p className="text-gray-400 italic">"{currentRank.mentalState}"</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Current Rank */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center mb-2">
                  <Crown className="w-5 h-5 text-yellow-400 mr-2" />
                  <span className="text-sm text-gray-400">Current Rank</span>
                </div>
                <div className="text-xl font-bold text-white">{currentRank.fullName}</div>
              </div>

              {/* EXP Gained */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center mb-2">
                  <Zap className="w-5 h-5 text-cyan-400 mr-2" />
                  <span className="text-sm text-gray-400">EXP Gained</span>
                </div>
                <div className={`text-xl font-bold ${expGained >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {expGained >= 0 ? "+" : ""}
                  {expGained}
                </div>
              </div>

              {/* Days Remaining */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center mb-2">
                  <Clock className="w-5 h-5 text-red-400 mr-2" />
                  <span className="text-sm text-gray-400">Days to GATE</span>
                </div>
                <div className="text-xl font-bold text-red-400">{daysRemaining}</div>
              </div>

              {/* Average EXP */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-400 mr-2" />
                  <span className="text-sm text-gray-400">Avg EXP/Day</span>
                </div>
                <div className="text-xl font-bold text-purple-400">{averageExpPerDay.toFixed(1)}</div>
              </div>
            </div>

            {/* Current Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Current Rank Progress</span>
                <span className="text-sm text-cyan-400">
                  {currentExp.toLocaleString()} / {currentRank.maxExp.toLocaleString()} EXP
                </span>
              </div>
              <div className="relative">
                <Progress value={getExpProgress()} className="h-3 bg-gray-700" />
                <div
                  className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
                  style={{ width: `${getExpProgress()}%` }}
                />
              </div>
            </div>

            {/* Next Rank Projection */}
            {nextRank && daysToNextRank !== null && (
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-3">
                  <Target className="w-5 h-5 text-blue-400 mr-2" />
                  <span className="text-lg font-semibold text-blue-400">Next Rank Projection</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Target Rank</div>
                    <div className="flex items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 mr-2"
                        style={{
                          backgroundColor: nextRank.color,
                          borderColor: nextRank.glowColor,
                          boxShadow: `0 0 10px ${nextRank.glowColor}40`,
                        }}
                      >
                        {nextRank.name}
                      </div>
                      <span className="text-white font-medium">{nextRank.fullName}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Estimated Time</div>
                    <div className="text-lg font-bold text-cyan-400">
                      {daysToNextRank === Number.POSITIVE_INFINITY ? "∞" : Math.ceil(daysToNextRank)} days
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-400 mb-1">EXP Required</div>
                  <div className="text-white">
                    {(nextRank.minExp - currentExp).toLocaleString()} EXP
                    {averageExpPerDay > 0 && (
                      <span className="text-gray-500 ml-2">(at {averageExpPerDay.toFixed(1)} EXP/day)</span>
                    )}
                  </div>
                </div>

                {/* Warning if too slow */}
                {daysToNextRank > daysRemaining && (
                  <div className="mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded">
                    <div className="text-red-400 text-sm font-medium">⚠️ Warning</div>
                    <div className="text-red-300 text-xs">
                      Current pace won't reach next rank before GATE. Increase daily EXP!
                    </div>
                  </div>
                )}

                {/* Encouragement if on track */}
                {daysToNextRank <= daysRemaining && daysToNextRank !== Number.POSITIVE_INFINITY && (
                  <div className="mt-3 p-2 bg-green-900/30 border border-green-700/50 rounded">
                    <div className="text-green-400 text-sm font-medium">✅ On Track</div>
                    <div className="text-green-300 text-xs">
                      Great pace! You can reach {nextRank.name}-Rank before GATE.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Motivational Message */}
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">
                {expGained > 0 ? "Keep pushing forward, Hunter!" : "Every setback is a setup for a comeback!"}
              </div>
              <Button
                onClick={onClose}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold px-8 py-2"
              >
                Continue Training
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

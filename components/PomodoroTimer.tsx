'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Play, Pause, RotateCcw, Lightbulb } from 'lucide-react'

interface BreakSuggestion {
  activity: string
  duration: number
  benefit: string
  timeOfDay: string
}

export default function PomodoroTimer() {
  const [workDuration, setWorkDuration] = useState(90) // Default 90 min
  const [breakDuration, setBreakDuration] = useState(15)
  const [timeLeft, setTimeLeft] = useState(workDuration * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [breakSuggestion, setBreakSuggestion] = useState<BreakSuggestion | null>(null)

  // Get circadian rhythm-based break suggestions
  const getCircadianBreakSuggestions = useCallback(() => {
    const hour = new Date().getHours()
    
    // Circadian rhythm-based activity recommendations
    const suggestions: BreakSuggestion[] = []

    // Early morning (6-9 AM): High alertness
    if (hour >= 6 && hour < 9) {
      suggestions.push(
        {
          activity: 'Light stretching & cold water splash',
          duration: 5,
          benefit: 'Boost alertness naturally',
          timeOfDay: 'Early Morning'
        },
        {
          activity: 'Quick meditation (5 min)',
          duration: 5,
          benefit: 'Enhance focus and retention',
          timeOfDay: 'Early Morning'
        }
      )
    }
    // Mid-morning (9-12 PM): Peak cognitive performance
    else if (hour >= 9 && hour < 12) {
      suggestions.push(
        {
          activity: 'Walk and hydration break',
          duration: 10,
          benefit: 'Maintain momentum during peak hours',
          timeOfDay: 'Mid-Morning'
        },
        {
          activity: 'Eye exercises & distance gazing',
          duration: 5,
          benefit: 'Reduce eye strain, refresh mind',
          timeOfDay: 'Mid-Morning'
        }
      )
    }
    // Afternoon (12-3 PM): Post-lunch dip
    else if (hour >= 12 && hour < 15) {
      suggestions.push(
        {
          activity: 'Protein snack + 10 min walk',
          duration: 15,
          benefit: 'Combat post-lunch fatigue',
          timeOfDay: 'Afternoon'
        },
        {
          activity: 'Power nap (20 min)',
          duration: 20,
          benefit: 'Reset circadian alertness (90 min cycle)',
          timeOfDay: 'Afternoon'
        }
      )
    }
    // Late afternoon (3-6 PM): Secondary peak
    else if (hour >= 15 && hour < 18) {
      suggestions.push(
        {
          activity: 'Light cardio or jump rope (5 min)',
          duration: 5,
          benefit: 'Boost energy for final study push',
          timeOfDay: 'Late Afternoon'
        },
        {
          activity: 'Healthy snack + breathing exercise',
          duration: 10,
          benefit: 'Sustained energy without crash',
          timeOfDay: 'Late Afternoon'
        }
      )
    }
    // Evening (6-9 PM): Declining alertness
    else if (hour >= 18 && hour < 21) {
      suggestions.push(
        {
          activity: 'Dinner + social chat (20 min)',
          duration: 20,
          benefit: 'Mental reset before final session',
          timeOfDay: 'Evening'
        },
        {
          activity: 'Low-intensity stretching',
          duration: 10,
          benefit: 'Reduce tension, prepare for wind-down',
          timeOfDay: 'Evening'
        }
      )
    }
    // Night (9 PM-6 AM): Sleep cycle
    else {
      suggestions.push(
        {
          activity: 'Stop studying, prepare for sleep',
          duration: 0,
          benefit: 'Align with natural sleep rhythm',
          timeOfDay: 'Night'
        }
      )
    }

    return suggestions
  }, [])

  // Get current mood based on circadian rhythm
  const getCircadianMood = useCallback(() => {
    const hour = new Date().getHours()
    
    if (hour >= 6 && hour < 9) return { mood: 'Refreshed & Alert', energy: 85 }
    if (hour >= 9 && hour < 12) return { mood: 'Peak Focus', energy: 95 }
    if (hour >= 12 && hour < 15) return { mood: 'Post-Lunch Dip', energy: 60 }
    if (hour >= 15 && hour < 18) return { mood: 'Recovering Energy', energy: 70 }
    if (hour >= 18 && hour < 21) return { mood: 'Evening Fatigue', energy: 55 }
    return { mood: 'Sleep Time', energy: 20 }
  }, [])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            setIsRunning(false)
            if (isWorkSession) {
              setSessionsCompleted((prev) => prev + 1)
              // Show break suggestions
              const suggestions = getCircadianBreakSuggestions()
              setBreakSuggestion(suggestions[Math.floor(Math.random() * suggestions.length)])
              // Switch to break
              setIsWorkSession(false)
              setTimeLeft(breakDuration * 60)
            } else {
              // Switch back to work
              setIsWorkSession(true)
              setTimeLeft(workDuration * 60)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, timeLeft, isWorkSession, workDuration, breakDuration, getCircadianBreakSuggestions])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progressPercentage = isWorkSession 
    ? ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100
    : ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100

  const { mood, energy } = getCircadianMood()

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-black border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-cyan-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Focus Timer (Pomodoro)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circadian Status */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Circadian Status</p>
              <p className="text-lg font-bold text-yellow-400">{mood}</p>
              <p className="text-xs text-gray-500">Energy Level: {energy}%</p>
            </div>
            <Progress value={energy} className="w-24 h-2" />
          </div>
        </div>

        {/* Time Display */}
        <div className="text-center">
          <div className="text-6xl font-mono font-bold text-cyan-400 mb-2">
            {formatTime(timeLeft)}
          </div>
          <p className="text-lg text-gray-300">
            {isWorkSession ? 'Work Session' : 'Break Time'}
          </p>
          <p className="text-sm text-gray-500">Sessions completed: {sessionsCompleted}</p>
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercentage} className="h-3" />

        {/* Duration Settings */}
        {!isRunning && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-gray-400">Work Duration (min)</Label>
              <Input
                type="number"
                value={workDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 90
                  setWorkDuration(val)
                  if (isWorkSession && !isRunning) setTimeLeft(val * 60)
                }}
                min="1"
                max="180"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-400">Break Duration (min)</Label>
              <Input
                type="number"
                value={breakDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 15
                  setBreakDuration(val)
                  if (!isWorkSession && !isRunning) setTimeLeft(val * 60)
                }}
                min="1"
                max="60"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              setIsRunning(false)
              setIsWorkSession(true)
              setTimeLeft(workDuration * 60)
            }}
            variant="outline"
            className="border-gray-600 hover:bg-gray-800 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>

        {/* Break Suggestion */}
        {breakSuggestion && !isWorkSession && (
          <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-purple-300 text-sm">{breakSuggestion.activity}</p>
                <p className="text-xs text-purple-200 mt-1">{breakSuggestion.benefit}</p>
                <p className="text-xs text-gray-400 mt-2">{breakSuggestion.duration} min suggested</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

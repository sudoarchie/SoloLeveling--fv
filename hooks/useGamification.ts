'use client';

import { useState, useCallback } from 'react'

interface GamificationMetrics {
  streak: number
  totalPoints: number
  achievements: Achievement[]
  level: number
  nextLevelProgress: number
  badges: Badge[]
  lastActiveTime: Date
}

interface Achievement {
  id: string
  name: string
  description: string
  unlocked: boolean
  unlockedDate?: Date
  points: number
}

interface Badge {
  id: string
  name: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockedDate: Date
}

export function useGamification() {
  const [metrics, setMetrics] = useState<GamificationMetrics>({
    streak: 0,
    totalPoints: 0,
    achievements: [],
    level: 1,
    nextLevelProgress: 0,
    badges: [],
    lastActiveTime: new Date(),
  })

  // Variable ratio reinforcement schedule (psychological hook)
  const calculateRandomReward = useCallback(() => {
    const baseReward = 10
    const variableMultiplier = Math.random() * 2 // 0-2x multiplier
    return Math.floor(baseReward * variableMultiplier)
  }, [])

  // Check for achievements (goal-setting psychology)
  const checkAchievements = useCallback((stats: any) => {
    const newAchievements: Achievement[] = []

    // Progressive challenge achievements
    if (stats.streak >= 7) {
      newAchievements.push({
        id: 'week-warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day study streak',
        unlocked: true,
        points: 100,
      })
    }

    if (stats.totalExp >= 1000) {
      newAchievements.push({
        id: 'exp-millionaire',
        name: 'EXP Millionaire',
        description: 'Earn 1000 total EXP',
        unlocked: true,
        points: 250,
      })
    }

    if (stats.perfectDays >= 3) {
      newAchievements.push({
        id: 'triple-threat',
        name: 'Triple Threat',
        description: 'Complete 3 perfect study days',
        unlocked: true,
        points: 150,
      })
    }

    return newAchievements
  }, [])

  return {
    metrics,
    setMetrics,
    calculateRandomReward,
    checkAchievements,
  }
}

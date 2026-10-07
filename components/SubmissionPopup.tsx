"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Gift, Check } from "lucide-react"

interface RankInfo {
  name: string
  fullName: string
  color: string
  glowColor: string
  minExp: number
  maxExp: number
  meaning: string
  gateInterpretation: string
  mentalState: string
  icon: React.ComponentType<any>
}

// Variable-ratio reward schedule — the dopamine mechanic (Skinner)
// 70% common / 20% rare / 8% epic / 2% legendary
export interface LootDrop {
  type: "common" | "rare" | "epic" | "legendary"
  label: string
  message: string
  bonusExp: number
  /** rare+ → cosmetic theme unlock; epic → title; legendary → streak freeze + avatar upgrade */
  reward?: {
    kind: "cosmetic" | "title" | "streakFreeze" | "avatar"
    value: string
  }
}

const LOOT_TABLE: { threshold: number; drop: LootDrop }[] = [
  {
    threshold: 0.02,
    drop: {
      type: "legendary",
      label: "JACKPOT",
      message: "Streak Freeze + Avatar Upgrade earned!",
      bonusExp: 200,
      reward: { kind: "streakFreeze", value: "1" },
    },
  },
  {
    threshold: 0.1,
    drop: {
      type: "epic",
      label: "BIG BONUS",
      message: 'Title unlocked — "Monarch of Mathematics"',
      bonusExp: 100,
      reward: { kind: "title", value: "Monarch of Mathematics" },
    },
  },
  {
    threshold: 0.3,
    drop: {
      type: "rare",
      label: "GREAT BONUS",
      message: "Cosmetic theme unlocked + bonus EXP",
      bonusExp: 50,
      reward: { kind: "cosmetic", value: "gold" },
    },
  },
  {
    threshold: 1.0,
    drop: {
      type: "common",
      label: "BONUS",
      message: "Consistency bonus",
      bonusExp: 10,
    },
  },
]

function rollLoot(): LootDrop {
  const roll = Math.random()
  for (const { threshold, drop } of LOOT_TABLE) {
    if (roll < threshold) return drop
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1].drop
}

interface SubmissionPopupProps {
  isOpen: boolean
  onClose: () => void
  expGained: number
  onLootClaimed?: (loot: LootDrop) => void
  currentRank?: RankInfo
  currentExp?: number
  daysRemaining?: number
  averageExpPerDay?: number
  daysToNextRank?: number | null
  nextRank?: RankInfo | null
}

export default function SubmissionPopup({
  isOpen,
  onClose,
  expGained,
  onLootClaimed,
}: SubmissionPopupProps) {
  const [loot, setLoot] = useState<LootDrop | null>(null)
  const claimed = useRef(false)
  useEffect(() => {
    if (isOpen) {
      setLoot(expGained > 0 ? rollLoot() : null)
      claimed.current = false
    }
  }, [isOpen, expGained])
  const finish = () => {
    if (loot && !claimed.current) {
      claimed.current = true
      onLootClaimed?.(loot)
    }
    onClose()
  }
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) finish()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-6 w-6" />
          </div>
          <DialogTitle>Progress, saved.</DialogTitle>
          <DialogDescription>
            Another step forward in your preparation.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-4xl font-semibold tracking-tight text-primary">
            {expGained}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              EXP for today
            </span>
          </p>
        </div>
        {loot && (
          <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
            <Gift className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">+{loot.bonusExp} bonus EXP</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {loot.message}
              </p>
            </div>
          </div>
        )}
        <Button className="mt-2" onClick={finish}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  Zap,
  Clock,
  Award,
  Flame,
} from "lucide-react"
import { RankInfo } from "@/lib/ranks"

interface RankUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  oldRank: RankInfo
  newRank: RankInfo
  currentExp: number
  weeklyHours: number
}

export default function RankUpgradeModal({
  isOpen,
  onClose,
  oldRank,
  newRank,
  currentExp,
  weeklyHours,
}: RankUpgradeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border border-primary/30 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl shadow-primary/20">
        {/* Top Solo Leveling System Notice Header */}
        <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-6 pt-6 pb-4 border-b border-primary/20">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
            <p className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
              SYSTEM NOTIFICATION · AWAKENING
            </p>
          </div>

          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary animate-spin-slow" />
              Hunter Rank Upgraded!
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Hunter Association has revised your classification.
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Rank Transition Visual */}
          <div className="relative flex items-center justify-center gap-3 sm:gap-6 rounded-xl border border-primary/20 bg-muted/40 p-5">
            {/* Old Rank */}
            <div className="flex flex-col items-center opacity-60">
              <span className="font-mono text-2xl font-bold text-muted-foreground">
                {oldRank.name}-Rank
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {oldRank.title}
              </span>
            </div>

            {/* Transition Arrow / Power Zap */}
            <div className="flex flex-col items-center px-1">
              <Zap className="h-6 w-6 text-primary animate-bounce" />
              <span className="text-[10px] font-mono font-bold text-primary uppercase">
                RANK UP
              </span>
            </div>

            {/* New Rank */}
            <div className="flex flex-col items-center">
              <span className="relative font-mono text-4xl sm:text-5xl font-black tracking-tight text-primary">
                {newRank.name}-Rank
              </span>
              <span className="relative text-xs sm:text-sm font-semibold text-foreground">
                {newRank.title}
              </span>
            </div>
          </div>

          {/* Motivational Quote */}
          {newRank.quote && (
            <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3.5 text-xs italic text-foreground/90 leading-relaxed">
              &ldquo;{newRank.quote}&rdquo;
            </div>
          )}

          {/* Verified Criteria: EXP & Weekly Study Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Verified Total EXP
              </div>
              <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-primary tabular-nums">
                {currentExp.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {newRank.minExp} EXP
                </span>
              </p>
              <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
                ✓ Points Qualified
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Weekly Study Time
              </div>
              <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-primary tabular-nums">
                {weeklyHours.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  hrs / wk
                </span>
              </p>
              <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
                ✓ Time Requirement Met ({newRank.minWeeklyHours}h)
              </p>
            </div>
          </div>

          {/* GATE Marks Predictor Tier */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Predicted GATE Marks Band
              </p>
              <p className="font-mono text-sm font-bold text-foreground">
                {newRank.gateMarksMin} – {newRank.gateMarksMax} Marks
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-primary font-semibold">
                {newRank.predictedAir}
              </p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                {newRank.collegeProspects.split(" • ")[0]}
              </p>
            </div>
          </div>

          {/* Action button */}
          <Button
            size="lg"
            className="w-full text-base font-bold shadow-lg shadow-primary/25"
            onClick={onClose}
          >
            <Award className="mr-2 h-4 w-4" />
            Embrace Your Power
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Volume2,
  VolumeX,
  Palette,
  Check,
  Zap,
  Clock,
  Award,
  Flame,
} from "lucide-react"
import { RankInfo, RankTheme } from "@/lib/ranks"

interface RankUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  oldRank: RankInfo
  newRank: RankInfo
  currentExp: number
  weeklyHours: number
  unlockedTheme: RankTheme
  onEquipTheme: (themeValue: string) => void
  isThemeEquipped: boolean
  onPlayBgm?: () => { stop: () => void; trackName: string }
  onStopBgm?: () => void
}

export default function RankUpgradeModal({
  isOpen,
  onClose,
  oldRank,
  newRank,
  currentExp,
  weeklyHours,
  unlockedTheme,
  onEquipTheme,
  isThemeEquipped,
  onPlayBgm,
  onStopBgm,
}: RankUpgradeModalProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [trackName, setTrackName] = useState<string>("")
  const [justEquipped, setJustEquipped] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true)
      setJustEquipped(false)
      if (onPlayBgm) {
        const handle = onPlayBgm()
        setTrackName(handle.trackName || "Solo Leveling Awakening")
      }
    } else {
      if (onStopBgm) onStopBgm()
    }
  }, [isOpen, onPlayBgm, onStopBgm])

  const toggleSound = () => {
    if (isPlaying) {
      if (onStopBgm) onStopBgm()
      setIsPlaying(false)
    } else {
      if (onPlayBgm) {
        const handle = onPlayBgm()
        setTrackName(handle.trackName || "Motivational Phonk")
      }
      setIsPlaying(true)
    }
  }

  const handleEquip = () => {
    onEquipTheme(unlockedTheme.value)
    setJustEquipped(true)
  }

  const handleClose = () => {
    if (onStopBgm) onStopBgm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg border border-primary/30 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl shadow-primary/20">
        {/* Top Solo Leveling System Notice Header */}
        <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-6 pt-6 pb-4 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
              <p className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                SYSTEM NOTIFICATION · AWAKENING
              </p>
            </div>
            <button
              onClick={toggleSound}
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
              title={isPlaying ? "Mute BGM" : "Play BGM"}
            >
              {isPlaying ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                  <span className="text-[10px] font-mono">BGM ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-mono">MUTED</span>
                </>
              )}
            </button>
          </div>

          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hunter Rank Upgraded!
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Hunter Association has revised your classification.
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-6">
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

            {/* Glowing Arrow */}
            <div className="flex flex-col items-center justify-center">
              <Zap className="h-6 w-6 text-primary animate-bounce" />
              <span className="text-[10px] font-mono font-bold text-primary uppercase">
                UPGRADE
              </span>
            </div>

            {/* New Rank (Glowing) */}
            <div className="relative flex flex-col items-center">
              <div
                className="absolute -inset-3 rounded-2xl opacity-40 blur-lg transition-all"
                style={{ backgroundColor: newRank.theme.color }}
              />
              <span
                className="relative font-mono text-4xl sm:text-5xl font-black tracking-tight"
                style={{ color: newRank.theme.color }}
              >
                {newRank.name}-Rank
              </span>
              <span className="relative text-xs sm:text-sm font-semibold text-foreground">
                {newRank.title}
              </span>
            </div>
          </div>

          {/* Motivational Quote */}
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3.5 text-xs italic text-foreground/90 leading-relaxed">
            &ldquo;{newRank.quote}&rdquo;
          </div>

          {/* Verified Criteria: EXP & Weekly Study Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Verified Total EXP
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-primary tabular-nums">
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
              <p className="mt-1 font-mono text-xl font-bold text-primary tabular-nums">
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

          {/* Theme Unlock Banner */}
          <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg border border-white/20"
                style={{ backgroundColor: unlockedTheme.color }}
              >
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    NEW THEME UNLOCKED
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {unlockedTheme.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {unlockedTheme.description}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant={isThemeEquipped || justEquipped ? "outline" : "default"}
              onClick={handleEquip}
              disabled={isThemeEquipped || justEquipped}
              className="shrink-0 font-medium"
            >
              {isThemeEquipped || justEquipped ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  Equipped
                </>
              ) : (
                "Equip Theme"
              )}
            </Button>
          </div>

          {/* Track name & BGM Indicator */}
          {isPlaying && trackName && (
            <p className="text-center font-mono text-[11px] text-muted-foreground flex items-center justify-center gap-2">
              <Volume2 className="h-3 w-3 text-primary animate-pulse" />
              <span>Playing: {trackName}</span>
            </p>
          )}

          {/* Action button */}
          <Button
            size="lg"
            className="w-full text-base font-bold shadow-lg shadow-primary/25"
            onClick={handleClose}
          >
            <Award className="mr-2 h-4 w-4" />
            Embrace Your Power
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

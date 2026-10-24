"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
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
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Maximize2,
  Film,
  Shuffle,
} from "lucide-react"
import { RankInfo, RankTheme } from "@/lib/ranks"
import {
  MOTIVATIONAL_SHORTS,
  MotivationalShort,
  getRandomMotivationalShort,
  getMotivationalShortById,
} from "@/lib/motivationalVideos"

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
  mediaChoice?: string
  initialShortId?: string
  isPreview?: boolean
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
  mediaChoice = "shorts-random",
  initialShortId,
  isPreview = false,
  onPlayBgm,
  onStopBgm,
}: RankUpgradeModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Determine starting short
  const getInitialShort = useCallback((): MotivationalShort => {
    if (initialShortId) {
      return getMotivationalShortById(initialShortId)
    }
    if (mediaChoice && mediaChoice !== "shorts-random" && mediaChoice !== "solo-leveling" && mediaChoice !== "phonk") {
      return getMotivationalShortById(mediaChoice)
    }
    return getRandomMotivationalShort()
  }, [initialShortId, mediaChoice])

  const [currentShort, setCurrentShort] = useState<MotivationalShort>(getInitialShort)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [justEquipped, setJustEquipped] = useState(false)
  const [audioTrackName, setAudioTrackName] = useState<string>("")

  const isAudioOnlyMode = mediaChoice === "solo-leveling" || mediaChoice === "phonk"

  // Select a new short
  const selectShort = useCallback((short: MotivationalShort) => {
    setCurrentShort(short)
    setCurrentTime(0)
    setIsAutoplayBlocked(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.load()
      const p = videoRef.current.play()
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(() => {
          // Fallback to muted if blocked
          if (videoRef.current) {
            videoRef.current.muted = true
            setIsMuted(true)
            setIsAutoplayBlocked(true)
            void videoRef.current.play().then(() => setIsPlaying(true))
          }
        })
      }
    }
  }, [])

  const nextShort = useCallback(() => {
    const currentIndex = MOTIVATIONAL_SHORTS.findIndex((s) => s.id === currentShort.id)
    const nextIndex = (currentIndex + 1) % MOTIVATIONAL_SHORTS.length
    selectShort(MOTIVATIONAL_SHORTS[nextIndex])
  }, [currentShort.id, selectShort])

  const shuffleShort = useCallback(() => {
    const remaining = MOTIVATIONAL_SHORTS.filter((s) => s.id !== currentShort.id)
    const random = remaining[Math.floor(Math.random() * remaining.length)] || MOTIVATIONAL_SHORTS[0]
    selectShort(random)
  }, [currentShort.id, selectShort])

  // Reset and autoplay when modal opens
  useEffect(() => {
    if (isOpen) {
      setJustEquipped(false)
      const chosen = getInitialShort()
      setCurrentShort(chosen)
      setIsPlaying(true)
      setIsMuted(false)
      setIsAutoplayBlocked(false)

      if (isAudioOnlyMode && onPlayBgm) {
        const handle = onPlayBgm()
        setAudioTrackName(handle.trackName || "Solo Leveling Awakening")
      } else {
        // Video mode: ensure background music is stopped so it doesn't clash with video audio
        if (onStopBgm) onStopBgm()

        // Give DOM a frame to mount video, then attempt autoplay with sound
        const timer = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0
            videoRef.current.muted = false
            const playPromise = videoRef.current.play()
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsPlaying(true)
                  setIsAutoplayBlocked(false)
                })
                .catch((err) => {
                  console.warn("Autoplay with audio blocked by browser policy, attempting muted fallback:", err)
                  if (videoRef.current) {
                    videoRef.current.muted = true
                    setIsMuted(true)
                    setIsAutoplayBlocked(true)
                    videoRef.current
                      .play()
                      .then(() => setIsPlaying(true))
                      .catch(() => setIsPlaying(false))
                  }
                })
            }
          }
        }, 150)
        return () => clearTimeout(timer)
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      if (onStopBgm) onStopBgm()
    }
  }, [isOpen, getInitialShort, isAudioOnlyMode, onPlayBgm, onStopBgm])

  const togglePlayPause = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      void videoRef.current.play().then(() => setIsPlaying(true))
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMuted = !videoRef.current.muted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
    if (!nextMuted) {
      setIsAutoplayBlocked(false)
      if (videoRef.current.paused) {
        void videoRef.current.play().then(() => setIsPlaying(true))
      }
    }
  }

  const handleUnmuteOverlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.muted = false
    setIsMuted(false)
    setIsAutoplayBlocked(false)
    void videoRef.current.play().then(() => setIsPlaying(true))
  }

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    void videoRef.current.play().then(() => setIsPlaying(true))
  }

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      void container.requestFullscreen().catch(() => {})
    } else {
      void document.exitFullscreen().catch(() => {})
    }
  }

  const handleEquip = () => {
    onEquipTheme(unlockedTheme.value)
    setJustEquipped(true)
  }

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    if (onStopBgm) onStopBgm()
    onClose()
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl border border-primary/40 bg-background/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl shadow-primary/30 max-h-[92vh] flex flex-col">
        {/* Top Solo Leveling System Notice Header */}
        <div className="relative bg-gradient-to-r from-primary/25 via-primary/10 to-transparent px-5 sm:px-6 pt-5 pb-3 border-b border-primary/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
              <p className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                SYSTEM NOTIFICATION · AWAKENING
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/40 text-primary text-[10px] font-mono px-2 py-0.5"
              >
                {isPreview ? "PREVIEW MODE" : "RANK UPGRADE"}
              </Badge>
              <button
                onClick={toggleMute}
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                title={isMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[10px] font-mono text-amber-400">MUTED</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 animate-pulse text-primary" />
                    <span className="text-[10px] font-mono">AUDIO ON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <DialogHeader className="mt-2 text-left">
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              Hunter Rank Upgraded!
              <Sparkles className="h-5 w-5 text-primary animate-spin" />
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Hunter Association has revised your classification. Embrace the power within.
            </p>
          </DialogHeader>
        </div>

        {/* Modal Main Body: Two Columns on md+, scrollable */}
        <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Left Column: Motivational Video Player */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div
                ref={containerRef}
                className="group relative w-full max-w-[280px] sm:max-w-[300px] aspect-[9/16] rounded-2xl overflow-hidden bg-black/90 border-2 shadow-xl shadow-primary/20 flex flex-col justify-end transition-all"
                style={{
                  borderColor: newRank.theme.color,
                  boxShadow: `0 0 25px ${newRank.theme.glowColor || "rgba(59, 130, 246, 0.35)"}`,
                }}
              >
                {/* HTML5 Video Element */}
                <video
                  ref={videoRef}
                  key={currentShort.id}
                  playsInline
                  autoPlay
                  loop
                  muted={isMuted}
                  className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                  onClick={togglePlayPause}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime)
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration)
                    }
                  }}
                  onEnded={() => {
                    // Loop or next short
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0
                      void videoRef.current.play()
                    }
                  }}
                >
                  <source src={currentShort.src} type="video/mp4" />
                  {currentShort.fallbackSrc && (
                    <source src={currentShort.fallbackSrc} type="video/mp4" />
                  )}
                  Your browser does not support the video tag.
                </video>

                {/* Top Overlay: Title & Tag */}
                <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 flex items-start justify-between pointer-events-none z-10">
                  <div className="space-y-0.5 max-w-[80%]">
                    <span className="inline-flex items-center gap-1 rounded bg-primary/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary-foreground backdrop-blur-sm">
                      <Flame className="h-2.5 w-2.5 text-amber-300" />
                      AWAKENING SHORT
                    </span>
                    <p className="text-xs font-bold text-white leading-tight drop-shadow">
                      {currentShort.title}
                    </p>
                  </div>

                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300 border border-white/10">
                    {MOTIVATIONAL_SHORTS.findIndex((s) => s.id === currentShort.id) + 1}/
                    {MOTIVATIONAL_SHORTS.length}
                  </span>
                </div>

                {/* Autoplay Audio Blocked Overlay (Tap to Unmute) */}
                {isAutoplayBlocked && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                    <button
                      onClick={handleUnmuteOverlay}
                      className="group/btn flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/50 transition-transform active:scale-95 animate-pulse"
                    >
                      <Volume2 className="h-4 w-4" />
                      <span>Tap to Unmute Audio</span>
                    </button>
                  </div>
                )}

                {/* Center Play/Pause indicator on click */}
                {!isPlaying && !isAutoplayBlocked && (
                  <div
                    onClick={togglePlayPause}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 cursor-pointer"
                  >
                    <div className="rounded-full bg-primary/90 p-3.5 text-primary-foreground shadow-xl transition-transform hover:scale-110">
                      <Play className="h-6 w-6 fill-current ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Bottom Overlay: Controls & Progress */}
                <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 space-y-2 pointer-events-auto">
                  {/* Progress Bar */}
                  <div
                    className="relative h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickPos = (e.clientX - rect.left) / rect.width
                      if (videoRef.current && duration > 0) {
                        videoRef.current.currentTime = clickPos * duration
                      }
                    }}
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: newRank.theme.color,
                      }}
                    />
                  </div>

                  {/* Player Controls Bar */}
                  <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePlayPause()
                        }}
                        className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMute()
                        }}
                        className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? (
                          <VolumeX className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-primary" />
                        )}
                      </button>

                      <button
                        onClick={handleRestart}
                        className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                        title="Restart Video"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          nextShort()
                        }}
                        className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium hover:bg-white/20 transition-colors"
                        title="Next Motivational Short"
                      >
                        <span>Next</span>
                        <SkipForward className="h-3 w-3" />
                      </button>

                      <button
                        onClick={handleFullscreen}
                        className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                        title="Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Selector Tabs Under Video */}
              <div className="mt-3 w-full max-w-[280px] sm:max-w-[300px]">
                <div className="flex items-center justify-between mb-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Film className="h-3 w-3 text-primary" />
                    Select Short
                  </span>
                  <button
                    onClick={shuffleShort}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Shuffle className="h-2.5 w-2.5" />
                    Shuffle
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {MOTIVATIONAL_SHORTS.map((short, idx) => {
                    const isSelected = short.id === currentShort.id
                    return (
                      <button
                        key={short.id}
                        onClick={() => selectShort(short)}
                        className={`truncate rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-all border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50"
                        }`}
                        title={short.subtitle}
                      >
                        <span className="font-mono text-[9px] opacity-75 mr-1">
                          #{idx + 1}
                        </span>
                        {short.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Hunter Rank Upgrade Details */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-4">
              {/* Rank Transition Visual */}
              <div className="relative flex items-center justify-center gap-3 sm:gap-6 rounded-2xl border border-primary/20 bg-muted/30 p-4 sm:p-5 overflow-hidden">
                <div
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl pointer-events-none"
                  style={{ backgroundColor: newRank.theme.color }}
                />

                {/* Old Rank */}
                <div className="flex flex-col items-center opacity-60">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-muted-foreground">
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
                    className="absolute -inset-3 rounded-2xl opacity-40 blur-lg transition-all pointer-events-none"
                    style={{ backgroundColor: newRank.theme.color }}
                  />
                  <span
                    className="relative font-mono text-3xl sm:text-5xl font-black tracking-tight"
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
              <div className="rounded-xl border-l-4 border-primary bg-primary/5 p-3.5 text-xs sm:text-sm italic text-foreground/90 leading-relaxed">
                &ldquo;{newRank.quote}&rdquo;
              </div>

              {/* Verified Criteria: EXP & Weekly Study Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card/60 p-3">
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

                <div className="rounded-xl border bg-card/60 p-3">
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
                    ✓ Time Met ({newRank.minWeeklyHours}h)
                  </p>
                </div>
              </div>

              {/* Theme Unlock Banner */}
              <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg border border-white/20"
                    style={{ backgroundColor: unlockedTheme.color }}
                  >
                    <Palette className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/40 text-primary"
                      >
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

              {/* Active Motivation Note */}
              <div className="text-center font-mono text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Flame className="h-3 w-3 text-amber-500 animate-pulse" />
                <span>Short playing: &ldquo;{currentShort.subtitle}&rdquo;</span>
              </div>

              {/* Action Button */}
              <Button
                size="lg"
                className="w-full text-base font-bold shadow-lg shadow-primary/25"
                onClick={handleClose}
              >
                <Award className="mr-2 h-4 w-4" />
                Embrace Your Power
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

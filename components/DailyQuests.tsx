"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  BookOpen,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Target,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Quest, QuestReward, StreakData } from "@/hooks/useDailyQuests"
import type { RevisionTopic } from "@/hooks/useSpacedRepetition"
import { useSoundEffects } from "@/hooks/useSoundEffects"

interface DailyQuestsProps {
  quests: Quest[]
  streak: StreakData
  loading: boolean
  reward: QuestReward | null
  allDone: boolean
  updateProgress: (questId: string, amount: number) => void
  dismissReward: () => void
  soundEnabled?: boolean
  dueTopics: RevisionTopic[]
  reviewsLoading: boolean
  onReview: (id: string, success: boolean) => Promise<void>
  onViewReviews: () => void
}

export function DailyQuests({
  quests,
  loading,
  reward,
  allDone,
  updateProgress,
  dismissReward,
  soundEnabled = false,
  dueTopics,
  reviewsLoading,
  onReview,
  onViewReviews,
}: DailyQuestsProps) {
  const sounds = useSoundEffects(soundEnabled)
  const [pendingReview, setPendingReview] = useState<string | null>(null)
  const completed = quests.filter((quest) => quest.completed).length
  const update = (id: string, amount: number) => {
    const quest = quests.find((item) => item.id === id)
    if (quest && amount > 0 && quest.progress + amount >= quest.target)
      sounds.formSubmit()
    else sounds.buttonClick()
    updateProgress(id, amount)
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Today’s goals</CardTitle>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {completed} of {quests.length}
            </span>
          </div>
          <CardDescription>
            A simple routine to keep you moving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Loading your goals…
            </p>
          ) : (
            <div className="divide-y">
              {quests.map((quest) => (
                <div key={quest.id} className="py-4 first:pt-2">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${quest.completed ? "bg-primary/10 text-primary" : "border text-muted-foreground"}`}
                    >
                      {quest.completed ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Target className="h-3 w-3" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium leading-6 ${quest.completed ? "text-muted-foreground" : ""}`}
                      >
                        {quest.title}
                      </p>
                      {!quest.completed && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {quest.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {!quest.completed && (
                    <div className="ml-9 mt-3 flex flex-wrap items-center gap-2">
                      {quest.target > 1 && (
                        <>
                          <Progress
                            value={Math.min(
                              100,
                              (quest.progress / quest.target) * 100,
                            )}
                            aria-label={`${quest.title} progress`}
                            className="h-1.5 min-w-12 flex-1"
                          />
                          <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                            {quest.progress}/{quest.target}
                          </span>
                        </>
                      )}
                      {quest.progress > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Undo one: ${quest.title}`}
                          onClick={() => update(quest.id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        aria-label={
                          quest.target === 1
                            ? `Complete: ${quest.title}`
                            : `Add one: ${quest.title}`
                        }
                        onClick={() => update(quest.id, 1)}
                      >
                        {quest.target === 1 ? (
                          <>
                            <Check />
                            Done
                          </>
                        ) : (
                          <>
                            <Plus />1
                          </>
                        )}
                      </Button>
                      {quest.target >= 5 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          aria-label={`Add five: ${quest.title}`}
                          onClick={() => update(quest.id, 5)}
                        >
                          +5
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            {allDone
              ? "All four goals complete. You showed up for yourself today."
              : "Complete all four to build your streak and earn a bonus."}
          </p>
          <section
            aria-labelledby="revisit-heading"
            className="mt-5 border-t pt-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3
                id="revisit-heading"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                Topics to revisit
              </h3>
              <span className="text-xs text-muted-foreground">
                {dueTopics.length} due
              </span>
            </div>
            {reviewsLoading ? (
              <p role="status" className="text-xs text-muted-foreground">
                Loading your reviews…
              </p>
            ) : dueTopics.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                All caught up. Your next topics will appear here when they’re
                due.
              </p>
            ) : (
              <div className="divide-y">
                {dueTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm leading-relaxed">
                        {topic.name}
                      </p>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {topic.difficulty} · Review {topic.reviewCount + 1}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={pendingReview !== null}
                      aria-label={`Mark reviewed: ${topic.name}`}
                      onClick={async () => {
                        if (pendingReview) return
                        sounds.unlock()
                        setPendingReview(topic.id)
                        try {
                          await onReview(topic.id, true)
                          toast.success(`Reviewed: ${topic.name}`, {
                            description: "Your next review is scheduled.",
                          })
                        } catch {
                          toast.error(
                            "Couldn’t save this review. Please try again.",
                          )
                        } finally {
                          setPendingReview(null)
                        }
                      }}
                    >
                      {pendingReview === topic.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Done
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewReviews}
              className="mt-3 h-8 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              View review schedule
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(reward)}
        onOpenChange={(open) => {
          if (!open) dismissReward()
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>Day well spent.</DialogTitle>
            <DialogDescription>
              You completed all your goals. Keep that rhythm going.
            </DialogDescription>
          </DialogHeader>
          <p className="py-3 text-3xl font-semibold text-primary">
            +{reward?.bonusExp}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              bonus EXP
            </span>
          </p>
          <p className="text-sm text-muted-foreground">{reward?.message}</p>
          <Button onClick={dismissReward}>Continue</Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

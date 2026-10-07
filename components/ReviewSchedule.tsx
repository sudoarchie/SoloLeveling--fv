"use client"

import { useState } from "react"
import { format, differenceInCalendarDays } from "date-fns"
import { BookOpen, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
  REVIEWS_TO_MASTER,
  type RevisionTopic,
} from "@/hooks/useSpacedRepetition"

interface ReviewScheduleProps {
  dueTopics: RevisionTopic[]
  upcomingTopics: RevisionTopic[]
  masteredTopics: RevisionTopic[]
  loading: boolean
  onCompleteReview: (id: string, success: boolean) => void | Promise<void>
  completedToday: Set<string>
}

function dueLabel(date: string) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00`)
  const days = differenceInCalendarDays(value, new Date())
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return format(value, "MMM d")
}

export function ReviewSchedule({
  dueTopics,
  upcomingTopics,
  masteredTopics,
  loading,
  onCompleteReview,
  completedToday,
}: ReviewScheduleProps) {
  const [pending, setPending] = useState<string | null>(null)
  const review = async (topic: RevisionTopic, success: boolean) => {
    if (pending) return
    setPending(topic.id)
    try {
      await onCompleteReview(topic.id, success)
      toast.success(
        success ? `Reviewed: ${topic.name}` : "We’ll revisit this tomorrow",
        {
          description: success
            ? "Your review schedule has been updated."
            : "A little more practice will help it stick.",
        },
      )
    } catch {
      toast.error("Couldn’t save this review. Please try again.")
    } finally {
      setPending(null)
    }
  }
  if (loading)
    return (
      <Card>
        <CardContent
          role="status"
          className="py-12 text-center text-sm text-muted-foreground"
        >
          Loading your review schedule…
        </CardContent>
      </Card>
    )
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ready for review</CardTitle>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {dueTopics.length} topics
            </span>
          </div>
          <CardDescription>
            Try recalling each topic before checking your notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dueTopics.length === 0 ? (
            <div className="py-10 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-6 w-6" />
              </span>
              <h2 className="font-medium">All clear for today</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {upcomingTopics.length + masteredTopics.length === 0
                  ? "Add topics to your daily log and we’ll build your review schedule here."
                  : "Your next reviews will appear here when they’re due."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {dueTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {topic.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {dueLabel(topic.nextReviewDate)}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {topic.difficulty}
                      </span>
                      <Progress
                        aria-label={`${topic.name} mastery`}
                        value={(topic.reviewCount / REVIEWS_TO_MASTER) * 100}
                        className="h-1 w-16"
                      />
                      <span className="text-xs text-muted-foreground">
                        {topic.reviewCount}/{REVIEWS_TO_MASTER} reviews
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={
                        pending !== null || completedToday.has(topic.id)
                      }
                      onClick={() => review(topic, false)}
                      className="text-muted-foreground"
                    >
                      Need practice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        pending !== null || completedToday.has(topic.id)
                      }
                      onClick={() => review(topic, true)}
                    >
                      {pending === topic.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Recalled it
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {upcomingTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
            <CardDescription>
              Spaced out to help you remember for longer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcomingTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="break-words text-sm">{topic.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dueLabel(topic.nextReviewDate)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {masteredTopics.length > 0 && (
        <details className="rounded-xl border bg-card p-6">
          <summary className="cursor-pointer text-sm font-medium">
            Mastered topics{" "}
            <span className="ml-2 text-muted-foreground">
              {masteredTopics.length}
            </span>
          </summary>
          <div className="mt-5 flex flex-wrap gap-2">
            {masteredTopics.map((topic) => (
              <span
                key={topic.id}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <Check className="h-3.5 w-3.5 text-primary" />
                {topic.name}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

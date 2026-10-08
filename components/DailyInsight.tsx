"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react"
import { MarkdownMessage } from "@/components/MarkdownMessage"

interface DailyInsightProps {
  plan: "free" | "pro"
  onOpenChat: () => void
}

export function DailyInsight({ plan, onOpenChat }: DailyInsightProps) {
  const [insight, setInsight] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (plan !== "pro") {
      setLoading(false)
      return
    }

    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      const today = new Date().toISOString().split("T")[0]
      const { data } = await supabase
        .from("ai_daily_insights")
        .select("*")
        .eq("user_id", user.id)
        .eq("insight_date", today)
        .maybeSingle()

      setInsight(data)
      setLoading(false)
    }
    load()
  }, [plan])

  // Don't render for free users
  if (plan !== "pro") return null
  if (loading || !insight) return null

  const summary = insight.summary || {}
  const riskMap: Record<string, string> = {
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    high: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  }
  const riskClass = riskMap[summary.riskLevel] ?? ""

  // Strip the JSON block from the display content
  const displayContent = insight.content
    .replace(/```json[\s\S]*?```/g, "")
    .trim()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Daily preparation briefing</CardTitle>
            <CardDescription className="text-xs">
              Synthesized by your AI mentor
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {summary.riskLevel && (
              <Badge variant="outline" className={`text-xs capitalize ${riskClass}`}>
                {summary.riskLevel} risk
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Today's focus topics/tasks */}
        {summary.todayFocus?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Today&apos;s focus
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.todayFocus.map((item: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Strengths & Weaknesses summary */}
        {(summary.strengths?.length > 0 || summary.weaknesses?.length > 0) &&
          !expanded && (
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              {summary.strengths?.length > 0 && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="mb-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Strengths
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {summary.strengths.map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.weaknesses?.length > 0 && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="mb-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Needs attention
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {summary.weaknesses.map((w: string, i: number) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        {/* Full analysis expandable */}
        {expanded && (
          <div className="border-t pt-3">
            <MarkdownMessage content={displayContent} />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
            )}
            {expanded ? "Show less" : "Full analysis"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenChat}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Ask mentor
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Brain,
  RotateCcw,
  Square,
  Copy,
  Check,
  ArrowUp,
  ArrowRight,
  TrendingDown,
  Target,
  Clock3,
  BarChart2,
  CalendarDays,
  Flame,
  Sparkles,
  SlidersHorizontal,
  History,
  Plus,
  Trash2,
  Clock,
  MessageSquare,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUserData } from "@/hooks/useUserData"
import { useAIMentor } from "@/hooks/useAIMentor"
import { usePomodoro } from "@/hooks/usePomodoro"
import { MarkdownMessage } from "@/components/MarkdownMessage"
import { toast } from "sonner"
import { differenceInDays } from "date-fns"

interface AIMentorProps {
  prefillPrompt?: string
}

const promptStarters = [
  {
    icon: BarChart2,
    title: "Performance audit",
    desc: "Examine my consistency, EXP rate, and preparation pace.",
    prompt:
      "Perform a realistic audit of my study trajectory. Where are my blind spots, and what does the data indicate about my consistency?",
  },
  {
    icon: TrendingDown,
    title: "Lag & cognitive gaps",
    desc: "Diagnose weak topics, forgetting curves, and passive learning traps.",
    prompt:
      "Based on cognitive psychology and my study logs, where am I lagging? Call out any habits that are hurting my retention.",
  },
  {
    icon: Target,
    title: "Exam runway strategy",
    desc: "Calibrate ratio of lectures vs. active question retrieval.",
    prompt:
      "Given my remaining days until GATE, what should my preparation strategy be? How should I divide time between lectures, spaced revision, and mock practice?",
  },
  {
    icon: Clock3,
    title: "Today's priority blueprint",
    desc: "Synthesize high-yield focus areas for today's study block.",
    prompt:
      "What should I prioritize today? Formulate an actionable plan based on my overdue topics and recent pace.",
  },
]

export function AIMentor({ prefillPrompt }: AIMentorProps) {
  const { progress, reports, saveProgress } = useUserData()
  const {
    sessions,
    currentSession,
    currentSessionId,
    messages,
    isStreaming,
    error,
    pastConversationsCount,
    sendMessage,
    createNewChat,
    selectSession,
    deleteSession,
    renameSession,
    stopStreaming,
  } = useAIMentor()

  const {
    status: pomodoroStatus,
    description: pomodoroDesc,
    timeLeft: pomodoroTimeLeft,
    activeDurationMinutes,
    getActiveContextForAI,
  } = usePomodoro()

  const [input, setInput] = useState("")
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryDraft, setMemoryDraft] = useState("")
  const [isSavingMemory, setIsSavingMemory] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitleText, setEditingTitleText] = useState("")

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Apply prefill prompt if passed from Pomodoro or elsewhere
  useEffect(() => {
    if (prefillPrompt && prefillPrompt.trim()) {
      setInput(prefillPrompt.trim())
      inputRef.current?.focus()
    }
  }, [prefillPrompt])

  // Keep memory draft synchronized with stored customPrompt
  useEffect(() => {
    setMemoryDraft(progress.customPrompt || "")
  }, [progress.customPrompt, memoryOpen])

  const daysToExam = progress.examDate
    ? Math.max(0, differenceInDays(progress.examDate, new Date()))
    : null

  const handleSaveMemory = async () => {
    try {
      setIsSavingMemory(true)
      await saveProgress({ customPrompt: memoryDraft.trim() })
      toast.success("Personalized memory saved", {
        description: "The mentor will remember these instructions in all future interactions.",
      })
      setMemoryOpen(false)
    } catch {
      toast.error("Failed to save instructions")
    } finally {
      setIsSavingMemory(false)
    }
  }

  // Auto-scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content)
    setCopiedIndex(index)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleSend = (text?: string) => {
    const query = text || input
    if (!query.trim() || isStreaming) return
    sendMessage(query, getActiveContextForAI())
    setInput("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingTitleId(id)
    setEditingTitleText(currentTitle)
  }

  const handleSaveRename = (id: string) => {
    if (editingTitleText.trim()) {
      renameSession(id, editingTitleText.trim())
    }
    setEditingTitleId(null)
  }

  const hasActivePomodoro =
    pomodoroStatus === "running" || (pomodoroDesc && pomodoroDesc.trim().length > 0)

  // ── Pro Plan Gate Screen ──────────────────────────────────
  if (progress.plan !== "pro") {
    return (
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-lg">AI Study Mentor</CardTitle>
              <CardDescription className="text-xs">
                Available on the Pro plan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The AI Study Mentor acts as an uncompromising coach grounded in cognitive
            science and deliberate practice. It audits your logs, spaced repetition
            queues, and mock exam results to provide honest diagnostics, reality checks,
            and optimized study strategies.
          </p>

          <div className="rounded-xl border bg-card/60 p-4 space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What Pro includes
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Automated midnight briefings with risk levels and daily focus</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Active recall & Ebbinghaus forgetting curve tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Cross-session memory connecting multiple past chat discussions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Active awareness of Pomodoro focus blocks and study tasks</span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Contact your administrator to enable Pro access on your account.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Empty State (or start of a new chat) ────────────────────
  if (messages.length === 0) {
    return (
      <>
        <div className="space-y-6">
          {/* Workspace Context Header */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Study Mentor</CardTitle>
                    {pastConversationsCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal gap-1 bg-primary/10 text-primary border-primary/20"
                        title="The AI carries forward memory of your past conversations"
                      >
                        <Sparkles className="h-3 w-3" />
                        Memory of {pastConversationsCount} past chat{pastConversationsCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Grounded in cognitive psychology, continuous cross-chat memory, and telemetry.
                  </CardDescription>
                </div>

                {/* Telemetry Pills & Custom Instructions button */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 bg-muted/30">
                    <Flame className="h-3.5 w-3.5 text-primary" />
                    {progress.currentExp.toLocaleString()} EXP
                  </span>
                  {daysToExam !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 bg-muted/30">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {daysToExam}d to GATE
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryOpen(true)}
                    className="h-7 text-xs gap-1.5 border-border/80 hover:border-primary/50"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Past Chats ({sessions.length})</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMemoryOpen(true)}
                    className="h-7 text-xs gap-1.5 border-border/80 hover:border-primary/50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    <span>Personal Memory</span>
                    {progress.customPrompt ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Active Pomodoro Focus Banner */}
              {hasActivePomodoro && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        Active Focus Task: &ldquo;{pomodoroDesc || `${activeDurationMinutes}m block`}&rdquo;
                        {pomodoroStatus === "running" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] text-emerald-500">
                            {Math.floor(pomodoroTimeLeft / 60)}m left
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        The AI mentor knows your active focus goal and will ground its answers in this task.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleSend(
                        `I am currently working on: "${pomodoroDesc || 'Deep study block'}". Give me 3 high-yield focus traps and 2 active recall diagnostic questions for this session.`,
                      )
                    }
                    className="h-7 text-xs text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                  >
                    <span>Test me on this task</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}

              {/* Command-style Starter Cards */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                {promptStarters.map((starter) => {
                  const Icon = starter.icon
                  return (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => handleSend(starter.prompt)}
                      className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground/80 group-hover:text-primary transition-colors">
                          <Icon className="h-4 w-4" />
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {starter.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {starter.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Input Dock */}
              <div className="rounded-xl border border-border/80 bg-background p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your syllabus pacing, numerical practice deficit, or active focus topic…"
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                />
                <div className="flex items-center justify-between border-t border-border/40 pt-2 px-1">
                  <span className="text-[11px] text-muted-foreground/60">
                    Enter to send · Shift+Enter for new line
                  </span>
                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs"
                  >
                    <span>Ask mentor</span>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat History Slide-Over Sheet */}
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="right" className="sm:max-w-md flex flex-col p-0">
            <SheetHeader className="p-5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </span>
                  <SheetTitle className="text-base">Chat History</SheetTitle>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    createNewChat()
                    setHistoryOpen(false)
                  }}
                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Chat</span>
                </Button>
              </div>
              <SheetDescription className="text-xs">
                All conversations are saved automatically. New chats reference context from earlier sessions.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sessions.map((sess) => {
                const isActive = sess.id === currentSessionId
                const isEditing = editingTitleId === sess.id
                return (
                  <div
                    key={sess.id}
                    className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                        : "border-border/70 bg-card hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectSession(sess.id)
                        setHistoryOpen(false)
                      }}
                      className="flex-1 min-w-0 pr-2 text-left"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitleText}
                          onChange={(e) => setEditingTitleText(e.target.value)}
                          onBlur={() => handleSaveRename(sess.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(sess.id)
                          }}
                          autoFocus
                          className="w-full text-xs bg-background border px-1.5 py-0.5 rounded"
                        />
                      ) : (
                        <p className="text-xs font-semibold truncate text-foreground">
                          {sess.title || "Conversation"}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {sess.messages.length} message{sess.messages.length === 1 ? "" : "s"} •{" "}
                        {new Date(sess.updatedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartRename(sess.id, sess.title)
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <SlidersHorizontal className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(sess.id)
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>

        {/* Custom Prompt / Personalized Memory Modal */}
        <Dialog open={memoryOpen} onOpenChange={setMemoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <DialogTitle className="text-base">Personal Memory & Instructions</DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                Tell your mentor about yourself, your target college/rank, weaknesses, study schedule, or how strictly you want to be treated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="e.g.:
• Target: GATE CS 2027 AIR < 100.
• Weakness: Prone to getting stuck in Math theory without solving numericals.
• Persona: Be strict and uncompromising. Scold me whenever I log under 3 hours of numerical solving.
• College/Job: Final year student, can study 5 hours on weekdays and 10 hours on weekends."
                rows={7}
                className="text-xs leading-relaxed font-normal resize-none"
              />

              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How this works:</p>
                <p>
                  These instructions are embedded permanently into every session and midnight briefing, alongside continuous cross-chat memory.
                </p>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
              {memoryDraft && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSavingMemory}
                  onClick={() => setMemoryDraft("")}
                  className="text-xs text-muted-foreground hover:text-destructive h-8 px-2"
                >
                  Clear memory
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemoryOpen(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveMemory}
                  disabled={isSavingMemory}
                  className="text-xs h-8"
                >
                  {isSavingMemory ? "Saving…" : "Save memory"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // ── Conversation Feed ─────────────────────────────────────
  return (
    <>
      <Card className="flex flex-col border-border/80" style={{ height: "calc(100vh - 210px)" }}>
        {/* Top Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b py-3 px-5 space-y-0">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold truncate max-w-[200px] sm:max-w-sm">
                  {currentSession.title || "Study Mentor"}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 px-1.5">
                  Pro
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {messages.length} message{messages.length === 1 ? "" : "s"} in this session
                {pastConversationsCount > 0 && (
                  <span className="ml-1 text-primary">
                    • {pastConversationsCount} past chat{pastConversationsCount === 1 ? "" : "s"} remembered
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="h-8 gap-1.5 text-xs border-border/80 hover:border-primary/50"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Past Chats</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
                {sessions.length}
              </span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoryOpen(true)}
              className="h-8 gap-1.5 text-xs border-border/80 hover:border-primary/50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Memory</span>
              {progress.customPrompt ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={createNewChat}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New chat</span>
            </Button>
          </div>
        </CardHeader>

        {/* Active Pomodoro Context Banner in conversation */}
        {hasActivePomodoro && (
          <div className="flex items-center justify-between border-b bg-primary/5 px-5 py-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-foreground truncate">
                Active Focus: &ldquo;{pomodoroDesc || `${activeDurationMinutes}m block`}&rdquo;
              </span>
              {pomodoroStatus === "running" && (
                <span className="text-muted-foreground font-mono">
                  ({Math.floor(pomodoroTimeLeft / 60)}m left)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                handleSend(
                  `I'm currently working on my focus goal: "${pomodoroDesc}". Ask me a sharp numerical question to test my understanding right now.`,
                )
              }
              className="text-[11px] text-primary hover:underline font-medium shrink-0 ml-2"
            >
              Quiz me on this →
            </button>
          </div>
        )}

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <span className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {msg.role === "user" ? "You" : "Mentor"}
              </span>

              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[90%] sm:max-w-[82%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-sm"
                    : "bg-card border border-border/70 text-foreground rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div>
                    {msg.content === "" && isStreaming ? (
                      <p className="text-xs text-muted-foreground italic">
                        Synthesizing cognitive advice…
                      </p>
                    ) : (
                      <MarkdownMessage
                        content={msg.content}
                        isStreaming={isStreaming && i === messages.length - 1}
                      />
                    )}

                    {msg.content !== "" && (
                      <div className="mt-3 flex items-center justify-end border-t border-border/40 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(msg.content, i)}
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {copiedIndex === i ? (
                            <>
                              <Check className="mr-1 h-3 w-3 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Dock */}
        <CardContent className="border-t p-3 sm:p-4 bg-card">
          {error && (
            <p className="mb-2 text-xs text-destructive text-center">{error}</p>
          )}

          <div className="rounded-xl border border-border/80 bg-background p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up or provide details on your study methods…"
              rows={2}
              disabled={isStreaming}
              className="w-full resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 min-h-[40px]"
            />
            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                Enter to send · Shift+Enter for new line
              </span>
              {isStreaming ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopStreaming}
                  className="ml-auto h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  size="sm"
                  className="ml-auto h-7 w-7 p-0 rounded-lg"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat History Slide-Over Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-5 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <History className="h-4 w-4" />
                </span>
                <SheetTitle className="text-base">Chat History</SheetTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  createNewChat()
                  setHistoryOpen(false)
                }}
                className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Chat</span>
              </Button>
            </div>
            <SheetDescription className="text-xs">
              All conversations are saved automatically. New chats reference context from earlier sessions.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sessions.map((sess) => {
              const isActive = sess.id === currentSessionId
              const isEditing = editingTitleId === sess.id
              return (
                <div
                  key={sess.id}
                  className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:border-primary/40 hover:bg-accent/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      selectSession(sess.id)
                      setHistoryOpen(false)
                    }}
                    className="flex-1 min-w-0 pr-2 text-left"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        onBlur={() => handleSaveRename(sess.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(sess.id)
                        }}
                        autoFocus
                        className="w-full text-xs bg-background border px-1.5 py-0.5 rounded"
                      />
                    ) : (
                      <p className="text-xs font-semibold truncate text-foreground">
                        {sess.title || "Conversation"}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {sess.messages.length} message{sess.messages.length === 1 ? "" : "s"} •{" "}
                      {new Date(sess.updatedAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </button>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartRename(sess.id, sess.title)
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(sess.id)
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Custom Prompt / Personalized Memory Modal */}
      <Dialog open={memoryOpen} onOpenChange={setMemoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <DialogTitle className="text-base">Personal Memory & Instructions</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Tell your mentor about yourself, your target college/rank, weaknesses, study schedule, or how strictly you want to be treated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              placeholder="e.g.:
• Target: GATE CS 2027 AIR < 100.
• Weakness: Prone to getting stuck in Math theory without solving numericals.
• Persona: Be strict and uncompromising. Scold me whenever I log under 3 hours of numerical solving.
• College/Job: Final year student, can study 5 hours on weekdays and 10 hours on weekends."
              rows={7}
              className="text-xs leading-relaxed font-normal resize-none"
            />

            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How this works:</p>
              <p>
                These instructions are embedded permanently into every session and midnight briefing, alongside continuous cross-chat memory.
              </p>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            {memoryDraft && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSavingMemory}
                onClick={() => setMemoryDraft("")}
                className="text-xs text-muted-foreground hover:text-destructive h-8 px-2"
              >
                Clear memory
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemoryOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveMemory}
                disabled={isSavingMemory}
                className="text-xs h-8"
              >
                {isSavingMemory ? "Saving…" : "Save memory"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

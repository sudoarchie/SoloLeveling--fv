"use client"

import { useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlarmClock,
  AlarmClockCheck,
  Bell,
  BellOff,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileQuestion,
  Flame,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react"
import {
  useTodos,
  getSlotStatus,
  formatTime12h,
  calculateMinutesFromTimeSlot,
  type TodoItem,
} from "@/hooks/useTodos"
import type { FocusType } from "@/hooks/usePomodoro"
import { format } from "date-fns"

interface TimetableTodoListProps {
  onAssignToTimer?: (todo: TodoItem) => void
  onOpenTimer?: () => void
  className?: string
}

const QUICK_TIME_PRESETS = [
  { label: "🌅 Early Morning (4am – 7am)", start: "04:00", end: "07:00", desc: "3h Pure Recall / Lecture" },
  { label: "⚡ Morning Deep Work (9am – 11:30am)", start: "09:00", end: "11:30", desc: "2.5h PYQ Practice" },
  { label: "📚 Afternoon Sprint (2pm – 3:30pm)", start: "14:00", end: "15:30", desc: "1.5h Revision Block" },
  { label: "🌙 Evening Simulation (6pm – 9pm)", start: "18:00", end: "21:00", desc: "3h Mock Exam Mode" },
]

export function TimetableTodoList({
  onAssignToTimer,
  onOpenTimer,
  className = "",
}: TimetableTodoListProps) {
  const {
    todos,
    activeTodoId,
    activeTodo,
    currentTimeStr,
    alarmPermission,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    assignTodoToTimer,
    unlinkActiveTodo,
    requestNotificationPermission,
    testAlarmSound,
  } = useTodos()

  const [activeTab, setActiveTab] = useState<"all" | "timetable" | "completed">("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)

  // Form states
  const [formTitle, setFormTitle] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formFocusType, setFormFocusType] = useState<FocusType>("lecture")
  const [formHasTimeSlot, setFormHasTimeSlot] = useState(true)
  const [formStartTime, setFormStartTime] = useState("04:00")
  const [formEndTime, setFormEndTime] = useState("07:00")
  const [formAlarmEnabled, setFormAlarmEnabled] = useState(true)
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high">("high")

  // Reset form or open for edit
  const handleOpenAdd = () => {
    setEditingTodo(null)
    setFormTitle("")
    setFormNotes("")
    setFormFocusType("lecture")
    setFormHasTimeSlot(true)
    setFormStartTime("04:00")
    setFormEndTime("07:00")
    setFormAlarmEnabled(true)
    setFormPriority("high")
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (todo: TodoItem) => {
    setEditingTodo(todo)
    setFormTitle(todo.title)
    setFormNotes(todo.notes || "")
    setFormFocusType(todo.focusType)
    setFormHasTimeSlot(todo.hasTimeSlot)
    setFormStartTime(todo.startTime || "04:00")
    setFormEndTime(todo.endTime || "07:00")
    setFormAlarmEnabled(todo.alarmEnabled)
    setFormPriority(todo.priority)
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formTitle.trim()) return

    const duration = formHasTimeSlot
      ? calculateMinutesFromTimeSlot(formStartTime, formEndTime)
      : 45

    if (editingTodo) {
      updateTodo(editingTodo.id, {
        title: formTitle.trim(),
        notes: formNotes.trim() || undefined,
        focusType: formFocusType,
        hasTimeSlot: formHasTimeSlot,
        startTime: formStartTime,
        endTime: formEndTime,
        durationMinutes: duration,
        alarmEnabled: formAlarmEnabled,
        priority: formPriority,
      })
    } else {
      addTodo({
        title: formTitle.trim(),
        notes: formNotes.trim() || undefined,
        focusType: formFocusType,
        hasTimeSlot: formHasTimeSlot,
        startTime: formStartTime,
        endTime: formEndTime,
        scheduledDate: format(new Date(), "yyyy-MM-dd"),
        durationMinutes: duration,
        alarmEnabled: formAlarmEnabled,
        alarmTriggered: false,
        priority: formPriority,
      })
    }

    setIsDialogOpen(false)
  }

  // Calculate live slot statuses for all timetable tasks
  const slotEvaluations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSlotStatus>>()
    todos.forEach((t) => {
      if (t.hasTimeSlot && t.startTime && t.endTime) {
        map.set(t.id, getSlotStatus(t.startTime, t.endTime, t.scheduledDate))
      }
    })
    return map
  }, [todos, currentTimeStr])

  // Active slot (if any)
  const activeSlotTodo = useMemo(() => {
    return todos.find((t) => {
      const evalStatus = slotEvaluations.get(t.id)
      return evalStatus?.isActive && !t.completed
    })
  }, [todos, slotEvaluations])

  // Filtered todos
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (activeTab === "completed") return t.completed
      if (activeTab === "timetable") return t.hasTimeSlot && !t.completed
      return !t.completed
    })
  }, [todos, activeTab])

  // Counts
  const completedCount = todos.filter((t) => t.completed).length
  const scheduledCount = todos.filter((t) => t.hasTimeSlot && !t.completed).length

  const handleAssign = (todo: TodoItem) => {
    assignTodoToTimer(todo.id)
    if (onAssignToTimer) onAssignToTimer(todo)
    if (onOpenTimer) onOpenTimer()
  }

  const durationPreview = useMemo(() => {
    if (!formHasTimeSlot) return 45
    return calculateMinutesFromTimeSlot(formStartTime, formEndTime)
  }, [formHasTimeSlot, formStartTime, formEndTime])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active Time Slot Live Banner */}
      {activeSlotTodo && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-md overflow-hidden animate-in fade-in slide-in-from-top-1">
          <div className="h-1 bg-primary w-full animate-pulse" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                    LIVE TIMETABLE SLOT NOW • {formatTime12h(activeSlotTodo.startTime)} – {formatTime12h(activeSlotTodo.endTime)}
                  </Badge>
                  {activeSlotTodo.alarmEnabled && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                      <AlarmClockCheck className="h-3.5 w-3.5" />
                      Alarm Active
                    </span>
                  )}
                </div>
                <h4 className="text-base font-semibold text-foreground tracking-tight">
                  {activeSlotTodo.title}
                </h4>
                {activeSlotTodo.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {activeSlotTodo.notes}
                  </p>
                )}
                {/* Slot progress */}
                {(() => {
                  const evalStatus = slotEvaluations.get(activeSlotTodo.id)
                  if (!evalStatus) return null
                  return (
                    <div className="flex items-center gap-3 pt-1">
                      <Progress value={evalStatus.progressPct} className="h-1.5 w-32" />
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {evalStatus.remainingMinutes}m remaining in window
                      </span>
                    </div>
                  )
                })()}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {activeTodoId === activeSlotTodo.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpenTimer}
                    className="h-9 gap-1.5 text-xs font-semibold border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Assigned to Timer</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAssign(activeSlotTodo)}
                    className="h-9 gap-1.5 text-xs font-semibold shadow-sm hover:scale-[1.02] transition-transform"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Assign & Start Timer</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Todo / Timetable Management Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b bg-card/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </span>
                <CardTitle className="text-base font-semibold">Study Timetable & Tasks</CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono py-0 h-4">
                  {scheduledCount} Scheduled
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Schedule study blocks (e.g. 4am–7am lectures), trigger alarms, and assign directly to the Focus Chamber.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testAlarmSound}
                      className="h-8 text-xs gap-1.5 border-border/70"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-amber-500" />
                      <span className="hidden sm:inline">Test Alarm</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Play a preview of the timetable audio alarm chime</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                size="sm"
                onClick={handleOpenAdd}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task / Slot</span>
              </Button>
            </div>
          </div>

          {/* Filter Bar & Active Timer Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Active ({todos.filter((t) => !t.completed).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timetable")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === "timetable"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Timetable Slots ({scheduledCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("completed")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === "completed"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>

            {/* Notification Permission Prompt if default */}
            {alarmPermission === "default" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestNotificationPermission}
                className="h-7 text-[11px] text-primary hover:bg-primary/10 gap-1 px-2"
              >
                <Bell className="h-3 w-3" />
                <span>Enable Desktop Alarms</span>
              </Button>
            )}

            {/* Currently Assigned to Timer Badge */}
            {activeTodo && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md text-[11px] text-primary">
                <Play className="h-3 w-3 fill-current" />
                <span className="font-medium truncate max-w-[170px]">
                  Assigned: {activeTodo.title}
                </span>
                <button
                  onClick={unlinkActiveTodo}
                  className="hover:text-destructive transition-colors ml-1"
                  title="Unlink from timer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto stroke-1" />
              <p className="text-sm font-medium text-foreground">
                {activeTab === "completed"
                  ? "No completed tasks yet."
                  : "No tasks found in this view."}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {activeTab === "completed"
                  ? "Complete tasks or finish focus timer sessions to see them logged here."
                  : "Create a timetable slot (e.g. 4am–7am lecture) to keep your daily study disciplined."}
              </p>
              {activeTab !== "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenAdd}
                  className="mt-2 text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Schedule First Study Slot
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTodos.map((todo) => {
                const evalStatus = slotEvaluations.get(todo.id)
                const isActive = evalStatus?.isActive
                const isAssigned = activeTodoId === todo.id

                return (
                  <div
                    key={todo.id}
                    className={`group relative rounded-xl border p-3.5 transition-all ${
                      isActive
                        ? "border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary/20"
                        : todo.completed
                          ? "border-border/50 bg-muted/20 opacity-70"
                          : "border-border/80 bg-card hover:border-primary/40 hover:bg-accent/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Checkbox & Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleComplete(todo.id)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                            todo.completed
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 hover:border-primary"
                          }`}
                        >
                          {todo.completed && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        </button>

                        <div className="space-y-1 min-w-0">
                          {/* Title & Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-sm font-medium tracking-tight ${
                                todo.completed ? "line-through text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {todo.title}
                            </span>

                            {/* Priority Badge */}
                            {todo.priority === "high" && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 border-rose-500/40 text-rose-500 bg-rose-500/10">
                                High
                              </Badge>
                            )}

                            {/* Focus Type Badge */}
                            <Badge variant="secondary" className="text-[10px] py-0 h-4 gap-1">
                              {todo.focusType === "lecture" && <BookOpen className="h-2.5 w-2.5 text-blue-500" />}
                              {todo.focusType === "practice" && <PenLine className="h-2.5 w-2.5 text-emerald-500" />}
                              {todo.focusType === "revision" && <RotateCcw className="h-2.5 w-2.5 text-purple-500" />}
                              {todo.focusType === "mock_test" && <FileQuestion className="h-2.5 w-2.5 text-amber-500" />}
                              <span className="capitalize">{todo.focusType.replace("_", " ")}</span>
                            </Badge>

                            {/* Live Active Now Badge */}
                            {isActive && !todo.completed && (
                              <Badge className="text-[10px] py-0 h-4 bg-emerald-600 text-white animate-pulse">
                                Active Slot Now
                              </Badge>
                            )}
                          </div>

                          {/* Notes */}
                          {todo.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {todo.notes}
                            </p>
                          )}

                          {/* Timetable Slot Pill & Status */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                            {todo.hasTimeSlot ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                                <Clock className="h-3 w-3 text-primary" />
                                {formatTime12h(todo.startTime)} – {formatTime12h(todo.endTime)}
                                <span className="text-muted-foreground/70">
                                  ({Math.round(todo.durationMinutes / 60 * 10) / 10}h)
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                Duration: {todo.durationMinutes}m
                              </span>
                            )}

                            {/* Alarm Switch / Pill */}
                            {todo.hasTimeSlot && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateTodo(todo.id, { alarmEnabled: !todo.alarmEnabled })
                                }
                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  todo.alarmEnabled
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                                    : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                                }`}
                                title={todo.alarmEnabled ? "Alarm active. Click to disable" : "Alarm off. Click to enable"}
                              >
                                {todo.alarmEnabled ? (
                                  <>
                                    <AlarmClockCheck className="h-3 w-3" />
                                    <span>Alarm On ({formatTime12h(todo.startTime)})</span>
                                  </>
                                ) : (
                                  <>
                                    <BellOff className="h-3 w-3" />
                                    <span>Alarm Off</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Time Status eval text */}
                            {evalStatus && !todo.completed && (
                              <span
                                className={`text-[11px] font-mono ${
                                  isActive
                                    ? "text-emerald-500 font-medium"
                                    : evalStatus.isUpcoming
                                      ? "text-blue-500"
                                      : "text-muted-foreground"
                                }`}
                              >
                                • {evalStatus.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!todo.completed && (
                          <Button
                            size="sm"
                            variant={isAssigned ? "secondary" : isActive ? "default" : "outline"}
                            onClick={() => handleAssign(todo)}
                            className={`h-8 text-xs font-semibold gap-1.5 ${
                              isAssigned
                                ? "bg-primary/15 text-primary border-primary/30"
                                : ""
                            }`}
                          >
                            {isAssigned ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                <span className="hidden sm:inline">Assigned</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 fill-current" />
                                <span>Assign to Timer</span>
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(todo)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit task"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTodo(todo.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Task Dialog with Timetable Slot and Alarm */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{editingTodo ? "Edit Task & Timetable Slot" : "New Study Task & Timetable Slot"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure task details, schedule a timetable window (e.g. 4am–7am), and set an audio alarm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-xs font-medium">
                Task Title *
              </Label>
              <Input
                id="task-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Computer Networks Lectures 5–7 (Layer Functions)"
                className="h-9 text-xs"
              />
            </div>

            {/* Focus Type & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Focus Category</Label>
                <Select
                  value={formFocusType}
                  onValueChange={(val: FocusType) => setFormFocusType(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture">Lecture / Video</SelectItem>
                    <SelectItem value="practice">PYQ Practice</SelectItem>
                    <SelectItem value="revision">Formula Revision</SelectItem>
                    <SelectItem value="mock_test">Mock Test</SelectItem>
                    <SelectItem value="other">General Study</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priority</Label>
                <Select
                  value={formPriority}
                  onValueChange={(val: "low" | "medium" | "high") => setFormPriority(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timetable Slot Switch */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="slot-toggle" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Set Timetable Window</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Assign exact start and end times (e.g. 4am – 7am)
                  </p>
                </div>
                <Switch
                  id="slot-toggle"
                  checked={formHasTimeSlot}
                  onCheckedChange={setFormHasTimeSlot}
                />
              </div>

              {formHasTimeSlot && (
                <div className="space-y-3 pt-2 border-t border-border/60">
                  {/* Start & End Time inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="start-time" className="text-[11px] text-muted-foreground">
                        Start Time (24h)
                      </Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="end-time" className="text-[11px] text-muted-foreground">
                        End Time (24h)
                      </Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Calculated Duration pill */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-background/80 p-2 rounded-lg border border-border/50">
                    <span>Scheduled Duration:</span>
                    <span className="font-semibold text-primary">
                      {Math.floor(durationPreview / 60)}h {durationPreview % 60}m ({durationPreview} min)
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Quick Slot Presets:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {QUICK_TIME_PRESETS.map((preset) => (
                        <button
                          key={preset.start}
                          type="button"
                          onClick={() => {
                            setFormStartTime(preset.start)
                            setFormEndTime(preset.end)
                          }}
                          className={`text-left p-1.5 rounded-lg border text-[11px] transition-colors ${
                            formStartTime === preset.start && formEndTime === preset.end
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border/60 bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="font-medium truncate">{preset.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alarm Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div className="space-y-0.5">
                      <Label htmlFor="alarm-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                        <AlarmClock className="h-3.5 w-3.5 text-amber-500" />
                        <span>Sound Alarm at Start Time ({formatTime12h(formStartTime)})</span>
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Plays a pleasant audio chime when this slot begins
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={testAlarmSound}
                        className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                        title="Test alarm sound"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        id="alarm-toggle"
                        checked={formAlarmEnabled}
                        onCheckedChange={setFormAlarmEnabled}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="task-notes" className="text-xs font-medium">
                Focus Notes (Optional)
              </Label>
              <Input
                id="task-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Topics to cover, target formula sheet, specific questions..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!formTitle.trim()}
              className="text-xs font-semibold gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{editingTodo ? "Update Slot" : "Add to Timetable"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

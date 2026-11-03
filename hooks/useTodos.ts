"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { FocusType, PomodoroPreset } from "@/hooks/usePomodoro"

export interface TodoItem {
  id: string
  title: string
  notes?: string
  focusType: FocusType
  preset?: PomodoroPreset
  durationMinutes: number
  hasTimeSlot: boolean
  startTime: string // "HH:mm" e.g. "04:00"
  endTime: string // "HH:mm" e.g. "07:00"
  scheduledDate: string // "yyyy-MM-dd"
  alarmEnabled: boolean
  alarmTriggered?: boolean
  completed: boolean
  completedAt?: string
  priority: "low" | "medium" | "high"
  createdAt: string
  timeSpentMinutes?: number
}

const STORAGE_KEY_TODOS = "gate_tracker_todos_v2"
const STORAGE_KEY_ACTIVE_TODO = "gate_tracker_active_todo_id"

/**
 * Calculates duration in minutes from HH:mm start and end time.
 * Handles overnight wraps if endTime < startTime.
 */
export function calculateMinutesFromTimeSlot(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 60
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 60

  let startTotal = startH * 60 + startM
  let endTotal = endH * 60 + endM
  if (endTotal <= startTotal) {
    endTotal += 24 * 60 // wrap to next day
  }
  return Math.max(15, endTotal - startTotal)
}

/**
 * Checks if current local time is inside the given time slot.
 */
export function getSlotStatus(startTime: string, endTime: string, dateStr?: string) {
  if (!startTime || !endTime) {
    return { isActive: false, isUpcoming: false, isPast: false, progressPct: 0, text: "" }
  }

  const now = new Date()
  const todayStr = format(now, "yyyy-MM-dd")
  if (dateStr && dateStr !== todayStr) {
    return {
      isActive: false,
      isUpcoming: dateStr > todayStr,
      isPast: dateStr < todayStr,
      progressPct: 0,
      text: dateStr > todayStr ? `Scheduled for ${dateStr}` : `Past date (${dateStr})`,
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)

  let startTotal = startH * 60 + startM
  let endTotal = endH * 60 + endM
  if (endTotal <= startTotal) {
    endTotal += 24 * 60
  }

  if (currentMinutes >= startTotal && currentMinutes < endTotal) {
    const elapsed = currentMinutes - startTotal
    const duration = endTotal - startTotal
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)))
    const remaining = endTotal - currentMinutes
    const remH = Math.floor(remaining / 60)
    const remM = remaining % 60
    const remText = remH > 0 ? `${remH}h ${remM}m left` : `${remM}m left`
    return {
      isActive: true,
      isUpcoming: false,
      isPast: false,
      progressPct: pct,
      remainingMinutes: remaining,
      text: `Active now • ${remText}`,
    }
  }

  if (currentMinutes < startTotal) {
    const until = startTotal - currentMinutes
    const untilH = Math.floor(until / 60)
    const untilM = until % 60
    const untilText = untilH > 0 ? `Starts in ${untilH}h ${untilM}m` : `Starts in ${untilM}m`
    return {
      isActive: false,
      isUpcoming: true,
      isPast: false,
      progressPct: 0,
      startsInMinutes: until,
      text: untilText,
    }
  }

  return {
    isActive: false,
    isUpcoming: false,
    isPast: true,
    progressPct: 100,
    text: "Slot ended",
  }
}

/**
 * Format 24h "04:00" to "4:00 AM"
 */
export function formatTime12h(time24: string): string {
  if (!time24) return ""
  const [hStr, mStr] = time24.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return time24
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${mStr.padStart(2, "0")} ${period}`
}

/**
 * High-quality pleasant web audio alarm chime
 */
export function playAlarmSound() {
  if (typeof window === "undefined") return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const playChimeSequence = (delayOffset: number) => {
      // 4 bell arpeggio notes
      const notes = [659.25, 830.61, 987.77, 1318.51] // E5, G#5, B5, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const startTime = ctx.currentTime + delayOffset + idx * 0.13
        const stopTime = startTime + 0.42

        osc.type = "triangle"
        osc.frequency.setValueAtTime(freq, startTime)

        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.0001, stopTime)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(startTime)
        osc.stop(stopTime)
      })
    }

    // Play two pulses for an unmistakable alarm reminder
    playChimeSequence(0)
    playChimeSequence(0.7)
  } catch (err) {
    console.warn("Alarm sound could not be initialized:", err)
  }
}

function getInitialDefaultTodos(): TodoItem[] {
  const today = format(new Date(), "yyyy-MM-dd")
  return [
    {
      id: "todo-seed-1",
      title: "Watch CN Lectures 5–7 (OSI & TCP/IP Layer Functions & Encapsulation)",
      notes: "Focus on header structures, flow control, and OSI vs TCP/IP mapping. Take concise revision formulas.",
      focusType: "lecture",
      preset: "180",
      durationMinutes: 180,
      hasTimeSlot: true,
      startTime: "04:00",
      endTime: "07:00",
      scheduledDate: today,
      alarmEnabled: true,
      alarmTriggered: false,
      completed: false,
      priority: "high",
      createdAt: new Date().toISOString(),
      timeSpentMinutes: 0,
    },
    {
      id: "todo-seed-2",
      title: "Operating Systems Paging & Virtual Memory Practice (25 GATE PYQs)",
      notes: "Multi-level paging, inverted page tables, TLB hit ratio numerical problems.",
      focusType: "practice",
      preset: "90",
      durationMinutes: 150,
      hasTimeSlot: true,
      startTime: "09:00",
      endTime: "11:30",
      scheduledDate: today,
      alarmEnabled: true,
      alarmTriggered: false,
      completed: false,
      priority: "high",
      createdAt: new Date().toISOString(),
      timeSpentMinutes: 0,
    },
    {
      id: "todo-seed-3",
      title: "DBMS Relational Algebra & Normalization Quick Revision",
      notes: "Lossless join decomposition, dependency preservation, BCNF vs 3NF rules.",
      focusType: "revision",
      preset: "90",
      durationMinutes: 90,
      hasTimeSlot: true,
      startTime: "14:00",
      endTime: "15:30",
      scheduledDate: today,
      alarmEnabled: false,
      alarmTriggered: false,
      completed: false,
      priority: "medium",
      createdAt: new Date().toISOString(),
      timeSpentMinutes: 0,
    },
    {
      id: "todo-seed-4",
      title: "GATE Full Paper Closed-Book Mock Exam Simulation",
      notes: "Strict 3-hour exam simulation. No notes, no interruptions.",
      focusType: "mock_test",
      preset: "180",
      durationMinutes: 180,
      hasTimeSlot: true,
      startTime: "18:00",
      endTime: "21:00",
      scheduledDate: today,
      alarmEnabled: true,
      alarmTriggered: false,
      completed: false,
      priority: "high",
      createdAt: new Date().toISOString(),
      timeSpentMinutes: 0,
    },
  ]
}

export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("")
  const [alarmPermission, setAlarmPermission] = useState<NotificationPermission | "unsupported">("default")
  const firedAlarmsRef = useRef<Set<string>>(new Set())

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = localStorage.getItem(STORAGE_KEY_TODOS)
      if (stored) {
        const parsed: TodoItem[] = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTodos(parsed)
        } else {
          const defaults = getInitialDefaultTodos()
          setTodos(defaults)
          localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(defaults))
        }
      } else {
        const defaults = getInitialDefaultTodos()
        setTodos(defaults)
        localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(defaults))
      }
    } catch {
      const defaults = getInitialDefaultTodos()
      setTodos(defaults)
    }

    try {
      const storedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_TODO)
      if (storedActiveId) setActiveTodoId(storedActiveId)
    } catch {}

    if (typeof window !== "undefined" && "Notification" in window) {
      setAlarmPermission(Notification.permission)
    } else {
      setAlarmPermission("unsupported")
    }
  }, [])

  // Persist helper
  const persistTodos = useCallback((updated: TodoItem[]) => {
    setTodos(updated)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent("gate-tracker-todos-changed", { detail: updated }))
      } catch {}
    }
  }, [])

  // Sync with cross-tab / custom events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TODOS && e.newValue) {
        try {
          setTodos(JSON.parse(e.newValue))
        } catch {}
      }
      if (e.key === STORAGE_KEY_ACTIVE_TODO) {
        setActiveTodoId(e.newValue)
      }
    }

    const handleCustomChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && Array.isArray(detail)) {
        setTodos(detail)
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("gate-tracker-todos-changed", handleCustomChange)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("gate-tracker-todos-changed", handleCustomChange)
    }
  }, [])

  // Clock tick & Alarm Checker loop (runs every 3 seconds)
  useEffect(() => {
    const checkClockAndAlarms = () => {
      const now = new Date()
      const nowH = String(now.getHours()).padStart(2, "0")
      const nowM = String(now.getMinutes()).padStart(2, "0")
      const formattedCurrent = `${nowH}:${nowM}`
      const todayDate = format(now, "yyyy-MM-dd")

      setCurrentTimeStr(formattedCurrent)

      // Check for scheduled alarms matching current minute
      todos.forEach((todo) => {
        if (!todo.hasTimeSlot || !todo.alarmEnabled || todo.completed) return
        if (todo.scheduledDate && todo.scheduledDate !== todayDate) return

        const alarmKey = `${todo.id}-${todayDate}-${todo.startTime}`
        if (todo.startTime === formattedCurrent && !firedAlarmsRef.current.has(alarmKey) && !todo.alarmTriggered) {
          firedAlarmsRef.current.add(alarmKey)

          // Play audio alarm
          playAlarmSound()

          // Show browser notification if allowed
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`⏰ Timetable Alarm: ${todo.title}`, {
                body: `Scheduled slot (${formatTime12h(todo.startTime)} – ${formatTime12h(todo.endTime)}) has started! Ready to focus?`,
                icon: "/icon.png",
              })
            } catch {}
          }

          // Show Sonner alert toast
          toast.info(`⏰ Timetable Alarm: ${formatTime12h(todo.startTime)} Slot Started!`, {
            description: `"${todo.title}" is scheduled now (${formatTime12h(todo.startTime)} - ${formatTime12h(todo.endTime)}).`,
            duration: 12000,
            action: {
              label: "Assign to Timer",
              onClick: () => {
                assignTodoToTimer(todo.id, true)
              },
            },
          })

          // Update todo alarmTriggered
          const updated = todos.map((t) => (t.id === todo.id ? { ...t, alarmTriggered: true } : t))
          persistTodos(updated)
        }
      })
    }

    checkClockAndAlarms()
    const timer = setInterval(checkClockAndAlarms, 3000)
    return () => clearInterval(timer)
  }, [todos, persistTodos])

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.info("Browser notifications not supported in this browser.")
      return "unsupported"
    }

    try {
      const res = await Notification.requestPermission()
      setAlarmPermission(res)
      if (res === "granted") {
        toast.success("Timetable alarm notifications enabled!")
      } else {
        toast.info("Notification permission was not granted. Audio chime alarms will still play.")
      }
      return res
    } catch {
      return "denied"
    }
  }, [])

  // Assign todo to Pomodoro Timer
  const assignTodoToTimer = useCallback(
    (todoId: string, autoScroll = false) => {
      const todo = todos.find((t) => t.id === todoId)
      if (!todo) return

      let duration = todo.durationMinutes || 45
      if (todo.hasTimeSlot && todo.startTime && todo.endTime) {
        duration = calculateMinutesFromTimeSlot(todo.startTime, todo.endTime)
      }

      // Determine best preset
      let chosenPreset: PomodoroPreset = "custom"
      if (duration === 25) chosenPreset = "25"
      else if (duration === 90) chosenPreset = "90"
      else if (duration === 180) chosenPreset = "180"
      else chosenPreset = "custom"

      setActiveTodoId(todo.id)
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY_ACTIVE_TODO, todo.id)
          // Broadcast to Pomodoro Timer
          window.dispatchEvent(
            new CustomEvent("pomodoro-assign-todo", {
              detail: {
                todoId: todo.id,
                title: todo.title,
                focusType: todo.focusType,
                preset: chosenPreset,
                customMinutes: duration,
                hasTimeSlot: todo.hasTimeSlot,
                startTime: todo.startTime,
                endTime: todo.endTime,
              },
            }),
          )
        } catch {}
      }

      toast.success("Assigned to Focus Chamber", {
        description: `"${todo.title}" (${duration}m) loaded into Pomodoro Timer.`,
      })

      if (autoScroll && typeof window !== "undefined") {
        const timerElem = document.getElementById("pomodoro-timer-section")
        if (timerElem) {
          timerElem.scrollIntoView({ behavior: "smooth" })
        }
      }
    },
    [todos],
  )

  // Unlink active todo
  const unlinkActiveTodo = useCallback(() => {
    setActiveTodoId(null)
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_TODO)
        window.dispatchEvent(new CustomEvent("pomodoro-assign-todo", { detail: null }))
      } catch {}
    }
    toast.info("Timer unlinked from todo.")
  }, [])

  // Add new task
  const addTodo = useCallback(
    (item: Omit<TodoItem, "id" | "createdAt" | "completed" | "timeSpentMinutes">) => {
      const newTodo: TodoItem = {
        ...item,
        id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        completed: false,
        timeSpentMinutes: 0,
      }
      const updated = [newTodo, ...todos]
      persistTodos(updated)
      toast.success("Task Added", {
        description: item.hasTimeSlot
          ? `Scheduled for ${formatTime12h(item.startTime)} – ${formatTime12h(item.endTime)}`
          : `Added "${item.title}" to your tasks.`,
      })
      return newTodo
    },
    [todos, persistTodos],
  )

  // Update existing task
  const updateTodo = useCallback(
    (id: string, patch: Partial<TodoItem>) => {
      const updated = todos.map((t) => (t.id === id ? { ...t, ...patch } : t))
      persistTodos(updated)
      toast.success("Task updated.")
    },
    [todos, persistTodos],
  )

  // Delete task
  const deleteTodo = useCallback(
    (id: string) => {
      const updated = todos.filter((t) => t.id !== id)
      if (activeTodoId === id) {
        unlinkActiveTodo()
      }
      persistTodos(updated)
      toast.info("Task removed.")
    },
    [todos, activeTodoId, unlinkActiveTodo, persistTodos],
  )

  // Toggle complete
  const toggleComplete = useCallback(
    (id: string) => {
      const updated = todos.map((t) => {
        if (t.id !== id) return t
        const nextCompleted = !t.completed
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        }
      })
      persistTodos(updated)
    },
    [todos, persistTodos],
  )

  // Record completed study minutes against active todo
  const recordFocusMinutesOnTodo = useCallback(
    (id: string, minutes: number) => {
      const updated = todos.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          timeSpentMinutes: (t.timeSpentMinutes || 0) + minutes,
        }
      })
      persistTodos(updated)
    },
    [todos, persistTodos],
  )

  // Active todo item object
  const activeTodo = todos.find((t) => t.id === activeTodoId) || null

  return {
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
    recordFocusMinutesOnTodo,
    requestNotificationPermission,
    testAlarmSound: playAlarmSound,
  }
}

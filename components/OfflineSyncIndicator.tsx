"use client"

import { useState, useEffect } from "react"
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Database,
  CloudOff,
  ArrowUpCircle,
  AlertTriangle,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  subscribeToSyncStatus,
  flushSyncQueue,
  clearSyncQueue,
  type SyncStatus,
} from "@/lib/offline-sync"
import { formatDistanceToNow } from "date-fns"

export function OfflineSyncIndicator({ className }: { className?: string }) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null,
    items: [],
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToSyncStatus((newStatus) => {
      setStatus(newStatus)
    })
    return unsubscribe
  }, [])

  const handleManualSync = async () => {
    await flushSyncQueue()
  }

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear pending offline changes?")) {
      await clearSyncQueue()
    }
  }

  const formattedLastSync = status.lastSyncTime
    ? formatDistanceToNow(new Date(status.lastSyncTime), { addSuffix: true })
    : "Never"

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 border ${
            !status.isOnline
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              : status.isSyncing
              ? "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse hover:bg-blue-500/20"
              : status.pendingCount > 0
              ? "bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
          } ${className || ""}`}
          title={
            !status.isOnline
              ? `Offline Mode • ${status.pendingCount} pending updates`
              : status.isSyncing
              ? `Auto-syncing ${status.pendingCount} items...`
              : status.pendingCount > 0
              ? `${status.pendingCount} offline items queued for sync`
              : "Hunter Network Connected • All synced"
          }
        >
          {!status.isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Offline</span>
              {status.pendingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/30 px-1 text-[10px] font-mono font-bold text-amber-200">
                  {status.pendingCount}
                </span>
              )}
            </>
          ) : status.isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
              <span className="hidden sm:inline">Syncing</span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/30 px-1 text-[10px] font-mono font-bold text-blue-200">
                {status.pendingCount}
              </span>
            </>
          ) : status.pendingCount > 0 ? (
            <>
              <ArrowUpCircle className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">Sync Queue</span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500/30 px-1 text-[10px] font-mono font-bold text-sky-200">
                {status.pendingCount}
              </span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline">Online</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 border-border/80 bg-card/95 p-4 backdrop-blur-xl shadow-xl"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight">
                Hunter Sync Status
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                status.isOnline
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
              }
            >
              {status.isOnline ? "Network Active" : "Disconnected"}
            </Badge>
          </div>

          {/* Description */}
          <div className="text-xs text-muted-foreground leading-relaxed">
            {!status.isOnline ? (
              <p className="flex items-start gap-1.5 text-amber-300/90">
                <CloudOff className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  You are working offline. Your timer sessions, EXP, and quest progress are safely saved locally and will auto-sync when back online.
                </span>
              </p>
            ) : status.pendingCount > 0 ? (
              <p>
                {status.pendingCount} change{status.pendingCount > 1 ? "s" : ""} waiting to sync with the server database.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>All progress is synchronized with the server.</span>
              </p>
            )}
          </div>

          {/* Pending Items List */}
          {status.pendingCount > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/40 p-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Pending Offline Changes</span>
                <span className="font-mono text-primary font-bold">
                  {status.pendingCount}
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
                {status.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded bg-background/60 px-2 py-1 text-[11px]"
                  >
                    <span className="truncate max-w-[190px] text-foreground/90 font-medium">
                      {item.description || `${item.action} ${item.table}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">
                      {item.table.replace("pomodoro_", "").replace("daily_", "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
            <span>Last Synced:</span>
            <span className="font-mono text-foreground/80">{formattedLastSync}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8"
              disabled={!status.isOnline || status.isSyncing || status.pendingCount === 0}
              onClick={handleManualSync}
            >
              <RefreshCw
                className={`h-3 w-3 ${status.isSyncing ? "animate-spin" : ""}`}
              />
              {status.isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            {status.pendingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-8 text-muted-foreground hover:text-destructive"
                onClick={handleClear}
                title="Discard un-synced local changes"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

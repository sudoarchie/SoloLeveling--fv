import { createClient } from "../utils/supabase/client.ts"
import { toast } from "sonner"

export type SyncAction = "insert" | "update" | "upsert" | "delete"

export interface SyncQueueItem {
  id: string
  table: string
  action: SyncAction
  payload: any
  matchCriteria?: Record<string, any>
  onConflict?: string
  timestamp: number
  retryCount: number
  userId?: string | null
  description?: string
}

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: number | null
  lastError: string | null
  items: SyncQueueItem[]
}

const DB_NAME = "gate_tracker_offline_db"
const DB_VERSION = 1
const STORE_NAME = "sync_queue"
const FALLBACK_KEY = "gate_tracker_offline_sync_queue"
const LAST_SYNC_KEY = "gate_tracker_last_sync_timestamp"

let isSyncingProcess = false
let syncListeners: ((status: SyncStatus) => void)[] = []

/**
 * Open or initialize IndexedDB store
 */
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        console.warn("[OfflineSync] IndexedDB open error, falling back to localStorage")
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
}

/**
 * Fallback storage operations using localStorage
 */
function getFromLocalStorage(): SyncQueueItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToLocalStorage(items: SyncQueueItem[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(items))
  } catch (err) {
    console.error("[OfflineSync] LocalStorage save failed", err)
  }
}

/**
 * Fetch all pending items from IndexedDB or localStorage
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB()
  if (!db) {
    return getFromLocalStorage()
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const results: SyncQueueItem[] = request.result || []
        // Sort chronologically (oldest first)
        results.sort((a, b) => a.timestamp - b.timestamp)
        resolve(results)
      }

      request.onerror = () => resolve(getFromLocalStorage())
    } catch {
      resolve(getFromLocalStorage())
    }
  })
}

/**
 * Enqueue a mutation for offline sync
 */
export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, "id" | "timestamp" | "retryCount">
): Promise<SyncQueueItem> {
  const newItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    retryCount: 0,
  }

  const db = await openDB()
  if (!db) {
    const items = getFromLocalStorage()
    items.push(newItem)
    saveToLocalStorage(items)
  } else {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        store.put(newItem)
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          const items = getFromLocalStorage()
          items.push(newItem)
          saveToLocalStorage(items)
          resolve()
        }
      } catch {
        const items = getFromLocalStorage()
        items.push(newItem)
        saveToLocalStorage(items)
        resolve()
      }
    })
  }

  await notifySyncStatus()
  return newItem
}

/**
 * Remove an item from the queue after successful sync
 */
export async function removeSyncItem(id: string): Promise<void> {
  const db = await openDB()
  if (!db) {
    const items = getFromLocalStorage().filter((item) => item.id !== id)
    saveToLocalStorage(items)
  } else {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        store.delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
  await notifySyncStatus()
}

/**
 * Update an item's retryCount in queue
 */
export async function updateSyncItemRetry(id: string, count: number): Promise<void> {
  const db = await openDB()
  if (!db) {
    const items = getFromLocalStorage()
    const found = items.find((i) => i.id === id)
    if (found) {
      found.retryCount = count
      saveToLocalStorage(items)
    }
    return
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(id)
      req.onsuccess = () => {
        if (req.result) {
          req.result.retryCount = count
          store.put(req.result)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Clear the entire sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await openDB()
  if (!db) {
    saveToLocalStorage([])
  } else {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        store.clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
  await notifySyncStatus()
}

/**
 * Check if the browser currently has connectivity
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true
  return navigator.onLine
}

/**
 * Register Background Sync with Service Worker if supported
 */
export async function registerBackgroundSync(tag = "gate-tracker-auto-sync"): Promise<boolean> {
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  ) {
    try {
      const reg = await navigator.serviceWorker.ready
      // @ts-expect-error - SyncManager is supported in Chromium browsers
      await reg.sync.register(tag)
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Notify all subscribers of current sync status
 */
export async function notifySyncStatus() {
  if (typeof window === "undefined") return

  const items = await getSyncQueue()
  let lastSyncTime: number | null = null
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    if (raw) lastSyncTime = Number(raw)
  } catch {}

  const status: SyncStatus = {
    isOnline: isOnline(),
    isSyncing: isSyncingProcess,
    pendingCount: items.length,
    lastSyncTime,
    lastError: null,
    items,
  }

  syncListeners.forEach((fn) => {
    try {
      fn(status)
    } catch (err) {
      console.error("[OfflineSync] Listener error:", err)
    }
  })

  // Broadcast window custom event
  window.dispatchEvent(new CustomEvent("gate-tracker-sync-status", { detail: status }))
}

/**
 * Subscribe to sync status changes
 */
export function subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
  syncListeners.push(callback)
  notifySyncStatus()

  return () => {
    syncListeners = syncListeners.filter((fn) => fn !== callback)
  }
}

/**
 * Flush and drain the offline sync queue by executing all pending mutations against Supabase
 */
export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncingProcess) {
    return { synced: 0, failed: 0 }
  }

  if (typeof window === "undefined" || !navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  const items = await getSyncQueue()
  if (items.length === 0) {
    return { synced: 0, failed: 0 }
  }

  isSyncingProcess = true
  await notifySyncStatus()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let syncedCount = 0
  let failedCount = 0

  for (const item of items) {
    // If not online anymore during the loop, abort cleanly and wait for next online event
    if (!navigator.onLine) {
      break
    }

    try {
      // If the mutation has a userId specified and it doesn't match current user, skip unless anonymous
      if (item.userId && user && item.userId !== user.id) {
        // Belongs to another user session, skip for now
        continue
      }

      let error: any = null

      if (item.action === "insert") {
        const res = await supabase.from(item.table).insert(item.payload)
        error = res.error
      } else if (item.action === "upsert") {
        const opts = item.onConflict ? { onConflict: item.onConflict } : undefined
        const res = await supabase.from(item.table).upsert(item.payload, opts)
        error = res.error
      } else if (item.action === "update") {
        let query = supabase.from(item.table).update(item.payload)
        if (item.matchCriteria) {
          for (const [k, v] of Object.entries(item.matchCriteria)) {
            query = query.eq(k, v)
          }
        }
        const res = await query
        error = res.error
      } else if (item.action === "delete") {
        let query = supabase.from(item.table).delete()
        if (item.matchCriteria) {
          for (const [k, v] of Object.entries(item.matchCriteria)) {
            query = query.eq(k, v)
          }
        }
        const res = await query
        error = res.error
      }

      if (error) {
        console.warn(`[OfflineSync] Mutation failed for ${item.table}:`, error)
        // Check if error is network related
        const msg = String(error.message || "").toLowerCase()
        const isNetwork =
          msg.includes("fetch") ||
          msg.includes("network") ||
          msg.includes("abort") ||
          msg.includes("connection")

        if (isNetwork) {
          // Pause queue drain; will retry when network stabilizes
          break
        } else {
          // Permanent or validation error (e.g., 400 Bad Request, row already deleted)
          // Increment retryCount; if > 3 drops item to avoid deadlocking the queue
          const nextRetry = (item.retryCount || 0) + 1
          if (nextRetry >= 3) {
            console.error(`[OfflineSync] Dropping permanently failed item ${item.id}`, item)
            await removeSyncItem(item.id)
            failedCount++
          } else {
            await updateSyncItemRetry(item.id, nextRetry)
          }
        }
      } else {
        // Success
        await removeSyncItem(item.id)
        syncedCount++
      }
    } catch (err: any) {
      console.warn(`[OfflineSync] Exception syncing ${item.id}:`, err)
      const msg = String(err?.message || "").toLowerCase()
      if (msg.includes("fetch") || msg.includes("network")) {
        break
      }
      failedCount++
    }
  }

  isSyncingProcess = false

  if (syncedCount > 0) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
    } catch {}

    toast.success(
      `⚡ Hunter System Synced: ${syncedCount} offline change${syncedCount > 1 ? "s" : ""} saved to database!`
    )

    // Notify components to refresh data from Supabase
    window.dispatchEvent(new CustomEvent("user-progress-changed"))
    window.dispatchEvent(
      new CustomEvent("gate-tracker-sync-completed", { detail: { count: syncedCount } })
    )
  }

  await notifySyncStatus()
  return { synced: syncedCount, failed: failedCount }
}

/**
 * Initialize auto-sync listeners on the window
 */
export function initAutoSync(): () => void {
  if (typeof window === "undefined") return () => {}

  const handleOnline = () => {
    toast.info("🌐 Network connection restored. Auto-syncing...", { duration: 3000 })
    flushSyncQueue()
    registerBackgroundSync()
  }

  const handleOffline = () => {
    toast.warning("📶 Offline Mode active. Your changes are safely preserved locally.", {
      duration: 4000,
    })
    notifySyncStatus()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      flushSyncQueue()
    }
  }

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === "GATE_TRACKER_SYNC") {
      flushSyncQueue()
    }
  }

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  document.addEventListener("visibilitychange", handleVisibilityChange)

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage)
  }

  // Initial check & flush if back online with pending queue
  if (navigator.onLine) {
    flushSyncQueue()
  }

  // Heartbeat check every 25 seconds if items exist
  const intervalId = window.setInterval(async () => {
    if (navigator.onLine) {
      const items = await getSyncQueue()
      if (items.length > 0) {
        flushSyncQueue()
      }
    }
  }, 25000)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage)
    }
    window.clearInterval(intervalId)
  }
}

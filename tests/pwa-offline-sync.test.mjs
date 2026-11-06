import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

// Setup minimal mock browser environment for testing lib/offline-sync in Node
const mockLocalStorage = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => {
      store[key] = String(val)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
}
globalThis.localStorage = mockLocalStorage
try {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value: true,
    configurable: true,
    writable: true,
  })
} catch {
  // Ignore if already defined
}
globalThis.CustomEvent = class CustomEvent {
  constructor(name, opts) {
    this.name = name
    this.detail = opts?.detail
  }
}

test("PWA manifest is valid and all declared icons exist on disk", () => {
  const manifestPath = path.resolve("public/manifest.json")
  assert.ok(fs.existsSync(manifestPath), "public/manifest.json must exist")

  const raw = fs.readFileSync(manifestPath, "utf-8")
  const manifest = JSON.parse(raw)

  assert.equal(manifest.name, "Solo Leveling | GATE Tracker Pro")
  assert.equal(manifest.short_name, "GATE Tracker")
  assert.equal(manifest.display, "standalone")
  assert.equal(manifest.start_url, "/")
  assert.equal(manifest.background_color, "#090d16")
  assert.equal(manifest.theme_color, "#3b82f6")
  assert.ok(Array.isArray(manifest.icons), "icons must be an array")
  assert.ok(manifest.icons.length >= 4, "Must provide multiple icon sizes")

  // Ensure all icon files exist in public/ and are non-empty
  for (const icon of manifest.icons) {
    const iconPath = path.join("public", icon.src)
    assert.ok(
      fs.existsSync(iconPath),
      `Declared icon ${icon.src} must physically exist in public/`
    )
    const stat = fs.statSync(iconPath)
    assert.ok(stat.size > 0, `Icon ${icon.src} must not be 0 bytes`)
  }

  // Ensure shortcuts are valid
  assert.ok(Array.isArray(manifest.shortcuts), "shortcuts must be an array")
  assert.ok(manifest.shortcuts.length >= 2, "Must provide shortcuts")
  for (const sc of manifest.shortcuts) {
    assert.ok(sc.name, "Shortcut must have name")
    assert.ok(sc.url, "Shortcut must have url")
  }
})

test("Service Worker is configured with offline fallback, no unauthenticated root pre-cache, and background sync", () => {
  const swPath = path.resolve("public/sw.js")
  assert.ok(fs.existsSync(swPath), "public/sw.js must exist")

  const swContent = fs.readFileSync(swPath, "utf-8")
  assert.ok(swContent.includes("gate-tracker-cache"), "SW must declare cache name")
  assert.ok(swContent.includes("/offline.html"), "SW must pre-cache offline fallback page")
  assert.ok(swContent.includes("gate-tracker-sync"), "SW must handle background sync")
  assert.ok(swContent.includes("skipWaiting"), "SW must support skipWaiting")
  assert.ok(swContent.includes("clients.claim"), "SW must claim clients on activate")

  // Ensure root '/' is NOT pre-cached in STATIC_ASSETS (which would cache a 307 redirect to /signin)
  const staticAssetsMatch = swContent.match(/const STATIC_ASSETS = \[([\s\S]*?)\]/)
  assert.ok(staticAssetsMatch, "STATIC_ASSETS array must exist")
  assert.ok(
    !staticAssetsMatch[1].includes("'/'") && !staticAssetsMatch[1].includes('"/"'),
    "STATIC_ASSETS must not pre-cache '/' to avoid caching login redirect"
  )
  assert.ok(
    swContent.includes("!response.url.includes('/signin')"),
    "SW must explicitly prevent caching signin page under root"
  )
})

test("Offline Fallback HTML page is complete and styled", () => {
  const offlinePath = path.resolve("public/offline.html")
  assert.ok(fs.existsSync(offlinePath), "public/offline.html must exist")

  const content = fs.readFileSync(offlinePath, "utf-8")
  assert.ok(content.includes("Offline Mode"), "Offline page must declare offline mode")
  assert.ok(content.includes("window.addEventListener('online'"), "Must auto-redirect when back online")
  assert.ok(content.includes("retryConnection"), "Must provide manual reconnect retry button")
})

test("Offline sync queue engine enqueues, sorts, updates, and clears items", async () => {
  mockLocalStorage.clear()
  const {
    enqueueSyncItem,
    getSyncQueue,
    removeSyncItem,
    updateSyncItemRetry,
    clearSyncQueue,
    isOnline,
  } = await import("../lib/offline-sync.ts")

  assert.equal(isOnline(), true, "isOnline should match navigator.onLine")

  // Enqueue first mutation
  const item1 = await enqueueSyncItem({
    table: "user_progress",
    action: "update",
    payload: { current_exp: 250 },
    userId: "hunter_001",
    description: "Earned 250 EXP",
  })

  assert.ok(item1.id.startsWith("sync_"), "Generated ID must have sync_ prefix")
  assert.equal(item1.retryCount, 0)
  assert.equal(item1.table, "user_progress")

  // Enqueue second mutation
  const item2 = await enqueueSyncItem({
    table: "daily_reports",
    action: "upsert",
    payload: { report_date: "2026-11-06", practice_hours: 2.5 },
    userId: "hunter_001",
    description: "Daily Study Report",
  })

  // Verify queue contents
  const queue = await getSyncQueue()
  assert.equal(queue.length, 2, "Queue should contain 2 items")
  assert.equal(queue[0].id, item1.id, "Queue must be in FIFO chronological order")
  assert.equal(queue[1].id, item2.id)

  // Update retry count
  await updateSyncItemRetry(item1.id, 2)
  const afterRetry = await getSyncQueue()
  assert.equal(afterRetry[0].retryCount, 2, "Retry count must be updated to 2")

  // Remove first item
  await removeSyncItem(item1.id)
  const afterRemove = await getSyncQueue()
  assert.equal(afterRemove.length, 1)
  assert.equal(afterRemove[0].id, item2.id)

  // Clear entire queue
  await clearSyncQueue()
  const emptyQueue = await getSyncQueue()
  assert.equal(emptyQueue.length, 0, "Queue should be empty after clear")
})

test("Sync Status subscriber notifies listeners upon state changes", async () => {
  mockLocalStorage.clear()
  const { enqueueSyncItem, subscribeToSyncStatus, clearSyncQueue } = await import("../lib/offline-sync.ts")

  let latestStatus = null
  const unsubscribe = subscribeToSyncStatus((status) => {
    latestStatus = status
  })

  // notifySyncStatus is async, wait a tick
  await new Promise((r) => setTimeout(r, 20))

  assert.ok(latestStatus !== null, "Subscriber should receive current status")
  assert.equal(latestStatus.pendingCount, 0)

  // Enqueue an item and verify subscriber was called
  await enqueueSyncItem({
    table: "pomodoro_sessions",
    action: "upsert",
    payload: { duration_minutes: 50 },
    description: "Focus 50m",
  })

  assert.equal(latestStatus.pendingCount, 1)
  assert.equal(latestStatus.items[0].description, "Focus 50m")

  // Cleanup
  unsubscribe()
  await clearSyncQueue()
})

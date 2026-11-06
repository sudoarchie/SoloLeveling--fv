"use client"

import { useEffect } from "react"
import { initAutoSync, registerBackgroundSync } from "@/lib/offline-sync"

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // 1. Initialize offline auto-sync listeners
    const cleanupSync = initAutoSync()

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registered with scope:", registration.scope)

            // Register background sync if supported
            registerBackgroundSync()

            // Check for updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing
              if (!newWorker) return

              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] New version available; skipping waiting.")
                  newWorker.postMessage({ type: "SKIP_WAITING" })
                }
              })
            })
          })
          .catch((error) => {
            console.warn("[PWA] Service Worker registration failed:", error)
          })
      })
    }

    // 3. Cache authenticated dashboard for offline access
    if (
      typeof window !== "undefined" &&
      "caches" in window &&
      window.location.pathname === "/" &&
      !document.title.toLowerCase().includes("sign in")
    ) {
      caches.open("gate-tracker-cache-v2").then(async (cache) => {
        try {
          const res = await fetch("/", { cache: "no-store" })
          if (res.ok && !res.redirected && !res.url.includes("/signin")) {
            await cache.put("/", res.clone())
          }
        } catch {}
      })
    }

    return () => {
      cleanupSync()
    }
  }, [])

  return null
}

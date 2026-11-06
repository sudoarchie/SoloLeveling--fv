"use client"

import { useState, useEffect } from "react"
import { Download, Sparkles, Smartphone, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if already in standalone display mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari standalone check
      window.navigator.standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // Listen for beforeinstallprompt on Chromium / Android / Desktop
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      toast.success("Solo Leveling GATE Tracker installed successfully!", {
        description: "You can now launch the app directly from your home screen or desktop.",
      })
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true)
      return
    }

    if (!deferredPrompt) {
      toast.info("PWA is already installed or supported natively via your browser menu.")
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
  }

  // If already installed, hide the install button
  if (isInstalled) {
    return null
  }

  // If not installable and not iOS, don't show
  if (!deferredPrompt && !isIOS) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        className={`h-8 gap-1.5 border-primary/30 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20 hover:text-primary transition-all ${
          className || ""
        }`}
        title="Install as Progressive Web App"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </Button>

      {/* iOS Install Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-md border-border bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg">
              Install GATE Tracker on iOS
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Follow these simple steps in Safari to add the app to your Home Screen with 100% offline access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                1
              </span>
              <p className="text-muted-foreground">
                Tap the <strong className="text-foreground">Share</strong> icon in the Safari bottom toolbar (the square with an arrow pointing up).
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                2
              </span>
              <p className="text-muted-foreground">
                Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                3
              </span>
              <p className="text-muted-foreground">
                Tap <strong className="text-foreground">Add</strong> in the top right corner. The Hunter System icon will now appear on your home screen!
              </p>
            </div>
          </div>

          <Button
            className="w-full text-xs"
            onClick={() => setShowIOSModal(false)}
          >
            Got it, Hunter!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

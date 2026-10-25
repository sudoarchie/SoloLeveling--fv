"use client"

import { useRef, useCallback } from "react"

let sharedAudioContext: AudioContext | null = null

/**
 * Custom hook for sound effects
 * Uses Web Audio API for synthesized sounds
 */
export function useSoundEffects(enabled = true) {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Create audio context on demand to avoid issues with browser autoplay policies
  const getAudioContext = useCallback(() => {
    if (!enabledRef.current || typeof window === "undefined") return null
    try {
      if (!sharedAudioContext || sharedAudioContext.state === "closed") {
        const Audio =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext
            }
          ).webkitAudioContext
        if (!Audio) return null
        sharedAudioContext = new Audio()
      }
      if (sharedAudioContext.state === "suspended") {
        void sharedAudioContext.resume().catch(() => {})
      }
      return sharedAudioContext
    } catch {
      console.warn("Web Audio API not supported")
      return null
    }
  }, [])

  // Button click sound - short and subtle
  const buttonClick = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      300,
      audioContext.currentTime + 0.1,
    )

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.1,
    )

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.1)
  }, [getAudioContext])

  // Toggle switch sound
  const toggleSwitch = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      600,
      audioContext.currentTime + 0.15,
    )

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.15,
    )

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.15)
  }, [getAudioContext])

  // Form submit sound
  const formSubmit = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      600,
      audioContext.currentTime + 0.1,
    )
    oscillator.frequency.exponentialRampToValueAtTime(
      800,
      audioContext.currentTime + 0.2,
    )

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.05,
      audioContext.currentTime + 0.2,
    )
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    )

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.3)
  }, [getAudioContext])

  // EXP gain sound
  const expGain = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      900,
      audioContext.currentTime + 0.1,
    )
    oscillator.frequency.exponentialRampToValueAtTime(
      1200,
      audioContext.currentTime + 0.2,
    )

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.15,
      audioContext.currentTime + 0.1,
    )
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    )

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.3)
  }, [getAudioContext])

  // Level up sound - classic three tone
  const levelUp = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    // Note 1
    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    osc1.type = "sine"
    osc1.frequency.setValueAtTime(400, audioContext.currentTime)
    osc1.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.2)
    gain1.gain.setValueAtTime(0.1, audioContext.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)

    // Note 2
    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    osc2.type = "sine"
    osc2.frequency.setValueAtTime(600, audioContext.currentTime + 0.2)
    osc2.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.4)
    gain2.gain.setValueAtTime(0.1, audioContext.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)

    // Note 3
    const osc3 = audioContext.createOscillator()
    const gain3 = audioContext.createGain()
    osc3.type = "sine"
    osc3.frequency.setValueAtTime(900, audioContext.currentTime + 0.4)
    osc3.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.6)
    gain3.gain.setValueAtTime(0.1, audioContext.currentTime + 0.4)
    gain3.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.5)
    gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7)
    osc3.connect(gain3)
    gain3.connect(audioContext.destination)

    osc1.start(audioContext.currentTime)
    osc1.stop(audioContext.currentTime + 0.3)
    osc2.start(audioContext.currentTime + 0.2)
    osc2.stop(audioContext.currentTime + 0.5)
    osc3.start(audioContext.currentTime + 0.4)
    osc3.stop(audioContext.currentTime + 0.7)
  }, [getAudioContext])

  return {
    unlock: () => {
      getAudioContext()
    },
    buttonClick,
    toggleSwitch,
    formSubmit,
    expGain,
    levelUp,
    stopUpgradeBgm: () => {},
  }
}

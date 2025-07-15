"use client"

import { useCallback, useRef, useEffect } from "react"

interface SoundEffects {
  buttonClick: () => void
  formSubmit: () => void
  levelUp: () => void
  expGain: () => void
  toggleSwitch: () => void
  notification: () => void
  achievement: () => void
}

export function useSoundEffects(): SoundEffects {
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundsRef = useRef<{ [key: string]: AudioBuffer | null }>({})
  const isInitializedRef = useRef(false)

  // Initialize audio context and load sounds
  const initializeAudio = useCallback(async () => {
    if (isInitializedRef.current) return

    try {
      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Create synthetic sounds since we can't load external files
      const createBeepSound = (frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.1) => {
        const sampleRate = audioContextRef.current!.sampleRate
        const numSamples = sampleRate * duration
        const buffer = audioContextRef.current!.createBuffer(1, numSamples, sampleRate)
        const channelData = buffer.getChannelData(0)

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate
          let sample = 0

          if (type === "sine") {
            sample = Math.sin(2 * Math.PI * frequency * t)
          } else if (type === "square") {
            sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1
          } else if (type === "sawtooth") {
            sample = 2 * (t * frequency - Math.floor(t * frequency + 0.5))
          } else if (type === "triangle") {
            sample = 2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1
          }

          // Apply envelope (fade in/out)
          const envelope = Math.min(1, Math.min(t * 10, (duration - t) * 10))
          channelData[i] = sample * envelope * volume
        }

        return buffer
      }

      // Create complex sounds
      const createComplexSound = (frequencies: number[], duration: number, type: OscillatorType = "sine") => {
        const sampleRate = audioContextRef.current!.sampleRate
        const numSamples = sampleRate * duration
        const buffer = audioContextRef.current!.createBuffer(1, numSamples, sampleRate)
        const channelData = buffer.getChannelData(0)

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate
          let sample = 0

          // Mix multiple frequencies
          for (const freq of frequencies) {
            if (type === "sine") {
              sample += Math.sin(2 * Math.PI * freq * t) / frequencies.length
            }
          }

          // Apply envelope
          const envelope = Math.min(1, Math.min(t * 5, (duration - t) * 5))
          channelData[i] = sample * envelope * 0.15
        }

        return buffer
      }

      // Create different sound effects
      soundsRef.current = {
        buttonClick: createBeepSound(800, 0.1, "sine", 0.08),
        formSubmit: createComplexSound([600, 800, 1000], 0.4, "sine"),
        levelUp: createComplexSound([440, 554, 659, 880], 0.8, "sine"),
        expGain: createBeepSound(1200, 0.25, "triangle", 0.12),
        toggleSwitch: createBeepSound(1400, 0.06, "sine", 0.06),
        notification: createComplexSound([800, 1000, 1200], 0.3, "sine"),
        achievement: createComplexSound([523, 659, 784, 1047], 0.6, "sine"),
      }

      isInitializedRef.current = true
    } catch (error) {
      console.warn("Audio initialization failed:", error)
    }
  }, [])

  // Play sound function
  const playSound = useCallback((soundName: string) => {
    if (!audioContextRef.current || !soundsRef.current[soundName]) return

    try {
      const source = audioContextRef.current.createBufferSource()
      const gainNode = audioContextRef.current.createGain()

      source.buffer = soundsRef.current[soundName]
      source.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      // Set volume based on sound type
      const volumes = {
        buttonClick: 0.2,
        formSubmit: 0.4,
        levelUp: 0.6,
        expGain: 0.3,
        toggleSwitch: 0.15,
        notification: 0.4,
        achievement: 0.5,
      }

      gainNode.gain.setValueAtTime(
        volumes[soundName as keyof typeof volumes] || 0.3,
        audioContextRef.current.currentTime,
      )

      source.start()
    } catch (error) {
      console.warn("Sound playback failed:", error)
    }
  }, [])

  // Initialize on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeAudio()
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
    }

    document.addEventListener("click", handleFirstInteraction)
    document.addEventListener("keydown", handleFirstInteraction)

    return () => {
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
    }
  }, [initializeAudio])

  return {
    buttonClick: () => playSound("buttonClick"),
    formSubmit: () => playSound("formSubmit"),
    levelUp: () => playSound("levelUp"),
    expGain: () => playSound("expGain"),
    toggleSwitch: () => playSound("toggleSwitch"),
    notification: () => playSound("notification"),
    achievement: () => playSound("achievement"),
  }
}

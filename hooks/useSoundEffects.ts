"use client"

import { useEffect } from "react"

import { useCallback, useRef } from "react"

interface SoundEffects {
  buttonClick: () => void
  formSubmit: () => void
  levelUp: () => void
  expGain: () => void
  toggleSwitch: () => void
  notification: () => void
  achievement: () => void
}

const createOscillator = (audioContext: AudioContext, frequency: number, type: OscillatorType) => {
  const oscillator = audioContext.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
  return oscillator
}

const createGainNode = (audioContext: AudioContext, gain: number) => {
  const gainNode = audioContext.createGain()
  gainNode.gain.setValueAtTime(gain, audioContext.currentTime)
  return gainNode
}

const playSound = (audioContext: AudioContext, oscillator: OscillatorNode, gainNode: GainNode) => {
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.2) // Sound duration
}

export function useSoundEffects(): SoundEffects {
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundsRef = useRef<{ [key: string]: AudioBuffer | null }>({})
  const isInitializedRef = useRef(false)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  // Initialize audio context and load sounds
  const initializeAudio = useCallback(async () => {
    if (isInitializedRef.current) return

    try {
      // Create audio context
      const audioContext = getAudioContext()

      // Create synthetic sounds since we can't load external files
      const createBeepSound = (frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.1) => {
        const sampleRate = audioContext.sampleRate
        const numSamples = sampleRate * duration
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate)
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
        const sampleRate = audioContext.sampleRate
        const numSamples = sampleRate * duration
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate)
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
  }, [getAudioContext])

  const buttonClick = useCallback(() => {
    const audioContext = getAudioContext()
    const oscillator = createOscillator(audioContext, 440, "sine") // A4 note
    const gainNode = createGainNode(audioContext, 0.1)
    playSound(audioContext, oscillator, gainNode)
  }, [getAudioContext])

  const toggleSwitch = useCallback(() => {
    const audioContext = getAudioContext()
    const oscillator1 = createOscillator(audioContext, 523.25, "square") // C5
    const oscillator2 = createOscillator(audioContext, 659.25, "triangle") // E5
    const gainNode = createGainNode(audioContext, 0.08)

    oscillator1.connect(gainNode)
    oscillator2.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator1.start()
    oscillator2.start()
    oscillator1.stop(audioContext.currentTime + 0.15)
    oscillator2.stop(audioContext.currentTime + 0.15)
  }, [getAudioContext])

  const formSubmit = useCallback(() => {
    const audioContext = getAudioContext()
    // Short, low frequency click
    const oscillator1 = createOscillator(audioContext, 120, "sawtooth")
    const gainNode1 = createGainNode(audioContext, 0.2)
    oscillator1.connect(gainNode1)
    gainNode1.connect(audioContext.destination)
    oscillator1.start()
    oscillator1.stop(audioContext.currentTime + 0.1)

    // Slightly higher frequency confirming click
    setTimeout(() => {
      const oscillator2 = createOscillator(audioContext, 240, "sine")
      const gainNode2 = createGainNode(audioContext, 0.15)
      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext.destination)
      oscillator2.start()
      oscillator2.stop(audioContext.currentTime + 0.1)
    }, 100)
  }, [getAudioContext])

  const expGain = useCallback(() => {
    const audioContext = getAudioContext()
    const frequencies = [300, 400, 500] // Ascending tones for gain
    let delay = 0
    frequencies.forEach((freq) => {
      setTimeout(() => {
        const oscillator = createOscillator(audioContext, freq, "triangle")
        const gainNode = createGainNode(audioContext, 0.1)
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3)
        playSound(audioContext, oscillator, gainNode)
      }, delay)
      delay += 80 // small delay between notes
    })
  }, [getAudioContext])

  const levelUp = useCallback(() => {
    const audioContext = getAudioContext()
    const frequencies = [523, 659, 784, 1047] // C5, E5, G5, C6 (major chord)
    let delay = 0

    frequencies.forEach((freq) => {
      setTimeout(() => {
        const oscillator = createOscillator(audioContext, freq, "sine")
        const gainNode = createGainNode(audioContext, 0.15) // Slightly louder
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6) // Longer decay
        playSound(audioContext, oscillator, gainNode)
      }, delay)
      delay += 120 // Delay for arpeggio effect
    })

    // Add a deeper, sustained tone for impact
    setTimeout(() => {
      const oscillator = createOscillator(audioContext, 261, "sawtooth") // C4
      const gainNode = createGainNode(audioContext, 0.2)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.0)
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 1.2)
    }, 200)
  }, [getAudioContext])

  const notification = useCallback(() => {
    const audioContext = getAudioContext()
    // Short, crisp high-pitched sound
    const oscillator1 = createOscillator(audioContext, 880, "square") // A5
    const gainNode1 = createGainNode(audioContext, 0.08)
    gainNode1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15)
    playSound(audioContext, oscillator1, gainNode1)

    setTimeout(() => {
      const oscillator2 = createOscillator(audioContext, 1046, "square") // C6
      const gainNode2 = createGainNode(audioContext, 0.1)
      gainNode2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15)
      playSound(audioContext, oscillator2, gainNode2)
    }, 100)
  }, [getAudioContext])

  const achievement = useCallback(() => {
    const audioContext = getAudioContext()
    const frequencies = [523, 659, 784, 1047] // C5, E5, G5, C6 (major chord)
    let delay = 0

    frequencies.forEach((freq) => {
      setTimeout(() => {
        const oscillator = createOscillator(audioContext, freq, "sine")
        const gainNode = createGainNode(audioContext, 0.2)
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6)
        playSound(audioContext, oscillator, gainNode)
      }, delay)
      delay += 120 // Delay for arpeggio effect
    })
  }, [getAudioContext])

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
    buttonClick,
    formSubmit,
    levelUp,
    expGain,
    toggleSwitch,
    notification,
    achievement,
  }
}

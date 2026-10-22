"use client"

import { useRef, useCallback } from "react"

let sharedAudioContext: AudioContext | null = null
let currentBgAudio: HTMLAudioElement | null = null

export type UpgradeBgmChoice = "solo-leveling" | "phonk" | "random"

/**
 * Custom hook for sound effects & motivational BGM
 * Uses Web Audio API for synthesized sounds & HTML5 Audio for high-energy upgrade BGM tracks
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

  /**
   * Synthesize iconic Solo Leveling system awakening fanfare:
   * Low sub-bass impact, ascending minor chord brass swell, high-frequency crystal resonance.
   */
  const playSoloLevelingFanfare = useCallback(() => {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // 1. Deep 808 Sub-Bass Impact (Awakening Thump)
    const subOsc = ctx.createOscillator()
    const subGain = ctx.createGain()
    subOsc.type = "sine"
    subOsc.frequency.setValueAtTime(140, now)
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.45)
    subGain.gain.setValueAtTime(0.4, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    subOsc.connect(subGain)
    subGain.connect(ctx.destination)
    subOsc.start(now)
    subOsc.stop(now + 1.2)

    // 2. Brass / Synth Swell (C-minor triad: C3, Eb3, G3, C4)
    const chordFreqs = [130.81, 155.56, 196.0, 261.63, 392.0]
    chordFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(freq * 0.98, now + 0.1)
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.5)

      // Lowpass filter for cinematic warmth
      const filter = ctx.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.setValueAtTime(600, now)
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.8)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.08 / (i + 1), now + 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + 0.05 * i)
      osc.stop(now + 2.1)
    })

    // 3. High crystal chime (System Alert Ping)
    const chimeOsc = ctx.createOscillator()
    const chimeGain = ctx.createGain()
    chimeOsc.type = "sine"
    chimeOsc.frequency.setValueAtTime(1760, now + 0.15) // A6
    chimeOsc.frequency.exponentialRampToValueAtTime(3520, now + 0.3) // A7
    chimeGain.gain.setValueAtTime(0.15, now + 0.15)
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
    chimeOsc.connect(chimeGain)
    chimeGain.connect(ctx.destination)
    chimeOsc.start(now + 0.15)
    chimeOsc.stop(now + 1.6)
  }, [getAudioContext])

  /**
   * Synthesize aggressive Phonk Cowbell rhythm pattern + 808 bass slide
   */
  const playPhonkBeat = useCallback(() => {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Classic Memphis / Drift Phonk cowbell frequencies (e.g. F#5, A5, B5, E6)
    const notes = [
      { freq: 740, time: 0.0, dur: 0.12 },
      { freq: 740, time: 0.14, dur: 0.1 },
      { freq: 880, time: 0.28, dur: 0.14 },
      { freq: 987, time: 0.44, dur: 0.18 },
      { freq: 740, time: 0.65, dur: 0.12 },
      { freq: 659, time: 0.8, dur: 0.22 },
      { freq: 1174, time: 1.05, dur: 0.35 },
    ]

    // 808 Sub-bass slide
    const bass = ctx.createOscillator()
    const bassGain = ctx.createGain()
    bass.type = "sawtooth"
    bass.frequency.setValueAtTime(110, now)
    bass.frequency.exponentialRampToValueAtTime(55, now + 0.35)
    bass.frequency.exponentialRampToValueAtTime(73.4, now + 0.8)

    const bassFilter = ctx.createBiquadFilter()
    bassFilter.type = "lowpass"
    bassFilter.frequency.setValueAtTime(260, now)

    bassGain.gain.setValueAtTime(0.3, now)
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.4)

    bass.connect(bassFilter)
    bassFilter.connect(bassGain)
    bassGain.connect(ctx.destination)

    bass.start(now)
    bass.stop(now + 1.5)

    // Cowbells
    notes.forEach((n) => {
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      // Phonk cowbells use metallic twin square/triangle detuned oscillators
      osc1.type = "square"
      osc2.type = "triangle"
      osc1.frequency.setValueAtTime(n.freq, now + n.time)
      osc2.frequency.setValueAtTime(n.freq * 1.51, now + n.time)

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = "bandpass"
      bandpass.frequency.setValueAtTime(n.freq, now + n.time)
      bandpass.Q.setValueAtTime(4.0, now + n.time)

      gain.gain.setValueAtTime(0.2, now + n.time)
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur)

      osc1.connect(bandpass)
      osc2.connect(bandpass)
      bandpass.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now + n.time)
      osc2.start(now + n.time)
      osc1.stop(now + n.time + n.dur)
      osc2.stop(now + n.time + n.dur)
    })
  }, [getAudioContext])

  /**
   * Stop any currently playing upgrade background music
   */
  const stopUpgradeBgm = useCallback(() => {
    if (currentBgAudio) {
      try {
        const audio = currentBgAudio
        // Smooth fadeout
        const fadeInterval = setInterval(() => {
          if (audio.volume > 0.1) {
            audio.volume = Math.max(0, audio.volume - 0.15)
          } else {
            clearInterval(fadeInterval)
            audio.pause()
            audio.currentTime = 0
            if (currentBgAudio === audio) {
              currentBgAudio = null
            }
          }
        }, 50)
      } catch {
        currentBgAudio = null
      }
    }
  }, [])

  /**
   * Play high-energy upgrade BGM:
   * Either Solo Leveling dark orchestral awakening or motivational drift phonk.
   * Seamlessly falls back to Web Audio API synthesizer if HTML audio is blocked.
   */
  const playUpgradeBgm = useCallback(
    (choice: UpgradeBgmChoice = "solo-leveling"): { stop: () => void; trackName: string } => {
      if (!enabledRef.current || typeof window === "undefined") {
        return { stop: () => {}, trackName: "" }
      }

      // Stop any existing playing track
      stopUpgradeBgm()

      // Determine track
      let selected: "solo-leveling" | "phonk"
      if (choice === "random") {
        selected = Math.random() > 0.5 ? "solo-leveling" : "phonk"
      } else {
        selected = choice
      }

      const trackUrl =
        selected === "phonk"
          ? "/audio/phonk-motivation.mp3"
          : "/audio/solo-leveling-awakening.mp3"

      const trackName =
        selected === "phonk"
          ? "Phonk Motivation (808 Drift)"
          : "Solo Leveling Awakening (Orchestral)"

      try {
        const audio = new Audio(trackUrl)
        audio.volume = 0.8
        currentBgAudio = audio

        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("HTML5 audio autoplay restricted, falling back to Web Audio synth:", err)
            // Fallback to in-browser synthesizer
            if (selected === "phonk") {
              playPhonkBeat()
            } else {
              playSoloLevelingFanfare()
            }
          })
        }

        return {
          stop: stopUpgradeBgm,
          trackName,
        }
      } catch (e) {
        console.warn("Could not play upgrade audio file:", e)
        if (selected === "phonk") {
          playPhonkBeat()
        } else {
          playSoloLevelingFanfare()
        }
        return {
          stop: stopUpgradeBgm,
          trackName,
        }
      }
    },
    [playPhonkBeat, playSoloLevelingFanfare, stopUpgradeBgm],
  )

  /**
   * Test / preview audio for settings
   */
  const previewBgm = useCallback(
    (choice: "solo-leveling" | "phonk") => {
      return playUpgradeBgm(choice)
    },
    [playUpgradeBgm],
  )

  return {
    unlock: () => {
      getAudioContext()
    },
    buttonClick,
    toggleSwitch,
    formSubmit,
    expGain,
    levelUp,
    playUpgradeBgm,
    stopUpgradeBgm,
    playSoloLevelingFanfare,
    playPhonkBeat,
    previewBgm,
  }
}

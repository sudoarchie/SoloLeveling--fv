export interface MotivationalShort {
  id: string
  title: string
  subtitle: string
  src: string
  fallbackSrc?: string
  duration: number
}

export const MOTIVATIONAL_SHORTS: MotivationalShort[] = [
  {
    id: "locked-in-goals",
    title: "Locked In On Goals",
    subtitle: "POV: You see someone else who is locked in on their goals",
    src: "/videos/locked-in-goals.mp4",
    fallbackSrc: "/audio/f7f59210065e403b0d2ed509388c5b94.mp4",
    duration: 15,
  },
  {
    id: "impossible-to-ignore",
    title: "Impossible to Ignore",
    subtitle: "Be f*cking impossible to ignore — relentlessly improve",
    src: "/videos/impossible-to-ignore.mp4",
    fallbackSrc: "/audio/fbc8d359ace262797d4b4f4ba08a7bd5_720w.mp4",
    duration: 15,
  },
  {
    id: "lock-in-motivation",
    title: "Lock In Motivation",
    subtitle: "CF Lock In — Inspirational Anime Quotes & Discipline",
    src: "/videos/lock-in-motivation.mp4",
    fallbackSrc:
      "/audio/From%20KlickPin%20CF%20Lock%20In%20!!!%20in%202025%20_%20Motivational%20quotes%20Life%20advice%20quotes%20inspiration%20Anime%20quotes%20inspirational.mp4",
    duration: 13,
  },
  {
    id: "awakening-power",
    title: "Hunter Awakening",
    subtitle: "Solo Leveling Hunter Awakening Edit — Unleash your power",
    src: "/videos/awakening-power.mp4",
    fallbackSrc: "/audio/h0oNvy88HsbqM-Pj.mp4",
    duration: 60,
  },
]

export type UpgradeMediaChoice =
  | "shorts-random"
  | "locked-in-goals"
  | "impossible-to-ignore"
  | "lock-in-motivation"
  | "awakening-power"
  | "solo-leveling"
  | "phonk"

export function getRandomMotivationalShort(): MotivationalShort {
  const index = Math.floor(Math.random() * MOTIVATIONAL_SHORTS.length)
  return MOTIVATIONAL_SHORTS[index]
}

export function getMotivationalShortById(id: string): MotivationalShort {
  const found = MOTIVATIONAL_SHORTS.find((s) => s.id === id)
  return found || MOTIVATIONAL_SHORTS[0]
}

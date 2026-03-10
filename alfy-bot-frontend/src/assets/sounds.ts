import bell1 from './sounds/bell-1.mp3'
import hang1 from './sounds/hang-1.mp3'
import hang2 from './sounds/hang-2.mp3'

export const sounds = {
  bell1,
  hang1,
  hang2
} as const

export type SoundKey = keyof typeof sounds

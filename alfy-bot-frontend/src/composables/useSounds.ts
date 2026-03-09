import { sounds } from '@/assets/sounds'

type SignalType = 'timer_end' | 'break_end'

export function useSounds() {
  const playSound = (audioSrc: string) => {
    try {
      const audio = new Audio(audioSrc)
      audio.volume = 1.0
      audio.play().catch((err) => {
        console.error('Ошибка воспроизведения звука:', err)
      })
    } catch (err) {
      console.error('Ошибка создания аудио:', err)
    }
  }

  const play = (_signal: SignalType) => {
    playSound(sounds.hang1)
  }

  return {
    play
  }
}

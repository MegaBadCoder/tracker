import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Хранит локальный режим отображения таймера, не изменяя его сессию. */
export const useTimerDisplayStore = defineStore('timer-display', () => {
  const isQuiet = useStorage('alfy:timer:quiet', false)
  const isFullscreen = ref(false)

  return { isQuiet, isFullscreen }
})

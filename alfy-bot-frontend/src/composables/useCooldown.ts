import { ref, onUnmounted } from 'vue'

export function useCooldown(seconds = 60) {
  const cooldown = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    stop()
    cooldown.value = seconds
    timer = setInterval(() => {
      cooldown.value--
      if (cooldown.value <= 0) stop()
    }, 1000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onUnmounted(stop)

  return { cooldown, start }
}

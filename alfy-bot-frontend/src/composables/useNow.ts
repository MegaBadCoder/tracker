import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Current time, refreshed on an interval.
 *
 * Defaults to a minute because that is the resolution the calendar's red line
 * already uses — anything finer would re-render for no visible gain.
 */
export function useNow(intervalMs = 60_000): Ref<Date> {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date()
    }, intervalMs)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return now
}

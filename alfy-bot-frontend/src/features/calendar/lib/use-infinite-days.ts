import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { startOfDay, addDays, differenceInCalendarDays } from 'date-fns'

export const DAY_WIDTH = 150
export const TRACK_WIDTH = 1_000_000
const SCROLL_ORIGIN = 500_000
const BUFFER_DAYS = 3
export const GUTTER_WIDTH = 56

export function useInfiniteDays(gridRef: Ref<HTMLElement | null>) {
  const anchorDate = startOfDay(new Date())
  const scrollLeft = ref(SCROLL_ORIGIN)
  let rafId = 0

  function dayOffset(date: Date): number {
    return differenceInCalendarDays(date, anchorDate) * DAY_WIDTH + SCROLL_ORIGIN
  }

  function dateFromX(x: number): Date {
    const dayIndex = Math.floor((x - SCROLL_ORIGIN) / DAY_WIDTH)
    return addDays(anchorDate, dayIndex)
  }

  const visibleDays = computed(() => {
    const viewportWidth = gridRef.value?.clientWidth ?? 800
    const left = scrollLeft.value
    const visibleWidth = viewportWidth - GUTTER_WIDTH
    const firstIndex = Math.floor((left - SCROLL_ORIGIN) / DAY_WIDTH) - BUFFER_DAYS
    const lastIndex = Math.ceil((left + visibleWidth - SCROLL_ORIGIN) / DAY_WIDTH) + BUFFER_DAYS
    const days: Date[] = []
    for (let i = firstIndex; i <= lastIndex; i++) {
      days.push(addDays(anchorDate, i))
    }
    return days
  })

  const dateRange = computed(() => {
    const viewportWidth = gridRef.value?.clientWidth ?? 800
    const left = scrollLeft.value
    const visibleWidth = viewportWidth - GUTTER_WIDTH
    const firstIndex = Math.floor((left - SCROLL_ORIGIN) / DAY_WIDTH)
    const lastIndex = Math.ceil((left + visibleWidth - SCROLL_ORIGIN) / DAY_WIDTH) - 1
    return {
      start: addDays(anchorDate, firstIndex),
      end: addDays(anchorDate, lastIndex),
    }
  })

  const centerDate = computed(() => {
    const viewportWidth = gridRef.value?.clientWidth ?? 800
    const centerPx = scrollLeft.value + (viewportWidth - GUTTER_WIDTH) / 2
    const dayIndex = Math.floor((centerPx - SCROLL_ORIGIN) / DAY_WIDTH)
    return addDays(anchorDate, dayIndex)
  })

  function onScroll() {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (gridRef.value) scrollLeft.value = gridRef.value.scrollLeft
    })
  }

  function scrollToDate(date: Date, smooth = false) {
    if (!gridRef.value) return
    const target = dayOffset(date)
    gridRef.value.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' })
  }

  function initScroll() {
    scrollToDate(new Date())
    if (gridRef.value) {
      const hour = new Date().getHours()
      gridRef.value.scrollTop = Math.max(0, (hour - 1) * 60)
    }
  }

  onMounted(() => {
    // Small delay to ensure DOM is ready
    requestAnimationFrame(() => initScroll())
  })

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
  })

  return { visibleDays, dateRange, centerDate, dayOffset, dateFromX, scrollToDate, initScroll, onScroll }
}

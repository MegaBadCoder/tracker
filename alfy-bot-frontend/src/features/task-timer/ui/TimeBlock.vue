<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Maximize2, Minimize2, PanelTop } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useSse } from '@/composables/useSse'
import { useTimerStore } from '../model/timer-store'
import { useTimerDisplayStore } from '../model/timer-display-store'
import TimerControls from './TimerControls.vue'

const store = useTimerStore()
const display = useTimerDisplayStore()
const { isFullscreen } = storeToRefs(display)
let wakeLock: WakeLockSentinel | null = null

const formattedTime = computed(() => {
  return store.formatTime(store.timeBlock)
})

const timerColorClass = computed(() => {
  if (store.isBreakPhase) return 'timer-break'
  if (store.isActive) return 'timer-work'
  return ''
})

const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => { wakeLock = null })
  } catch { /* ignore — browser denied */ }
}

const releaseWakeLock = async () => {
  await wakeLock?.release()
  wakeLock = null
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

watch(
  () => isFullscreen.value && store.phase > 0,
  (shouldLock) => shouldLock ? requestWakeLock() : releaseWakeLock()
)

const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    if (store.phase > 0) {
      store.recalcTimeBlock()
      store.ensureSWTimer()
    }
    if (isFullscreen.value && store.phase > 0) {
      await requestWakeLock()
    }
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  store.restoreSession()
})

useSse('/events', (event) => {
  if (event === 'timer.updated')
    void store.restoreSession()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  isFullscreen.value = false
  releaseWakeLock()
})
</script>

<template>
  <Transition
    enter-active-class="timer-enter-active"
    leave-active-class="timer-leave-active"
    enter-from-class="timer-enter-from"
    leave-to-class="timer-leave-to"
  >
    <div
      v-if="store.phase > 0 && (!display.isQuiet || isFullscreen)"
      :class="[
        'timer-block z-[1000] pointer-events-auto',
        timerColorClass,
        isFullscreen ? 'timer-fullscreen' : 'timer-compact group'
      ]"
    >
    <Button
      v-if="!isFullscreen"
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Свернуть таймер в шапку"
      title="Свернуть в шапку"
      @click="display.isQuiet = true"
    >
      <PanelTop :size="16" />
    </Button>
    <Button
      v-if="isFullscreen"
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Выйти из полноэкранного таймера"
      @click="toggleFullscreen"
      class="absolute z-10 top-4 left-4 text-white"
    >
      <Minimize2 :size="20" />
    </Button>

    <div v-if="isFullscreen" class="phase-name">{{ store.namePhase }}</div>

    <div
      :class="[
        'flex items-center gap-3',
        isFullscreen ? 'flex-col' : 'flex-row'
      ]"
    >
      <div
        :class="[
          'font-mono font-bold',
          isFullscreen ? 'text-[120px] text-white mb-10' : 'text-2xl'
        ]"
      >
        {{ formattedTime }}
      </div>

      <div class="flex gap-2 items-center">
        <TimerControls />
        <Button
          v-if="!isFullscreen"
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Открыть таймер на весь экран"
          title="На весь экран"
          @click="toggleFullscreen"
        >
          <Maximize2 :size="16" />
        </Button>
      </div>
    </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Base — transition for color changes */
.timer-block {
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .timer-block {
    transition: none;
  }
}

/* ── Compact (bottom bar) ── */
.timer-compact {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 16px oklch(0 0 0 / 0.08);
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
}

/* ── Fullscreen ── */
.timer-fullscreen {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  background-color: oklch(0.13 0 0 / 0.95);
}

/* ── Work phase — soft red ── */

/* Light */
.timer-work.timer-compact {
  background-color: oklch(0.97 0.008 25);
  border-color: oklch(0.88 0.02 25);
}

.timer-work.timer-fullscreen {
  background-color: oklch(0.18 0.012 25 / 0.96);
}

/* ── Break phase — soft blue ── */

/* Light */
.timer-break.timer-compact {
  background-color: oklch(0.95 0.03 250);
  border-color: oklch(0.88 0.05 250);
}

.timer-break.timer-fullscreen {
  background-color: oklch(0.18 0.06 250 / 0.96);
}

/* ── Dark mode overrides ── */
.dark .timer-work.timer-compact {
  background-color: oklch(0.22 0.012 25);
  border-color: oklch(0.35 0.025 25);
}

.dark .timer-break.timer-compact {
  background-color: oklch(0.25 0.06 250);
  border-color: oklch(0.35 0.08 250);
}

/* ── Phase name (fullscreen) ── */
.phase-name {
  font-size: 1.5rem;
  font-weight: 500;
  color: oklch(0.9 0 0);
  margin-bottom: 1.25rem;
  letter-spacing: 0.025em;
}

/* ── Enter / Leave transitions ── */
.timer-enter-active {
  transition: opacity 0.3s ease;
}

.timer-leave-active {
  transition: opacity 0.2s ease;
}

.timer-enter-from,
.timer-leave-to {
  opacity: 0;
}
</style>

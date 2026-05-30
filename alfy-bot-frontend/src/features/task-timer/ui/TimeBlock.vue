<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTimerStore } from '../model/timer-store'
import { Button } from '@/components/ui/button'
import { Play, Pause, Square } from 'lucide-vue-next'

const store = useTimerStore()
const isFullscreen = ref(false)
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

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (store.phase > 0) {
      store.recalcTimeBlock()
      store.ensureSWTimer()
    }
    if (isFullscreen.value && store.phase > 0) {
      await requestWakeLock()
    }
  }
})

onMounted(() => {
  store.restoreSession()
})

onUnmounted(() => {
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
      v-if="store.phase > 0"
      :class="[
        'timer-block z-[1000] pointer-events-auto',
        timerColorClass,
        isFullscreen ? 'timer-fullscreen' : 'timer-compact group'
      ]"
    >
    <button
      v-if="!isFullscreen"
      @click="toggleFullscreen"
      class="absolute top-[5px] left-[5px] z-10 w-5 h-5 bg-muted rounded cursor-pointer transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 flex items-center justify-center"
    >
      <span class="text-muted-foreground text-[10px] leading-none">□</span>
    </button>
    <button
      v-if="isFullscreen"
      @click="toggleFullscreen"
      class="absolute z-10 top-4 left-4 text-white hover:opacity-70 cursor-pointer transition-all duration-200"
    >
      −
    </button>

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
        <Button
          @click="store.toggleTimer"
          variant="outline"
          size="icon"
        >
          <Play v-if="!store.isActive" :size="16" />
          <Pause v-else :size="16" />
        </Button>
        <Button
          v-if="store.phase > 0"
          @click="store.isActive || !store.isStartTimeBlock() ? store.stopTimeBlock(true) : store.resetToInitialState()"
          variant="outline"
          size="icon"
        >
          <Square :size="16" />
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
  background-color: oklch(0.95 0.03 25);
  border-color: oklch(0.88 0.05 25);
}

.timer-work.timer-fullscreen {
  background-color: oklch(0.18 0.06 25 / 0.96);
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
  background-color: oklch(0.25 0.06 25);
  border-color: oklch(0.35 0.08 25);
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

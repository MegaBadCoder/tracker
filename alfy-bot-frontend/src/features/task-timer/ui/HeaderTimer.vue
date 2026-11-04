<script setup lang="ts">
import { Maximize2, PanelBottom, Pause } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTimerDisplayStore } from '../model/timer-display-store'
import { useTimerStore } from '../model/timer-store'
import TimerControls from './TimerControls.vue'

const store = useTimerStore()
const display = useTimerDisplayStore()
const isOpen = ref(false)
const isVisible = computed(() => store.phase > 0 && display.isQuiet && !display.isFullscreen)
const time = computed(() => store.formatTime(store.timeBlock))
const status = computed(() => `${store.namePhase}${store.isActive ? '' : ', пауза'}`)

watch(isVisible, () => {
  isOpen.value = false
})

function showFullscreen() {
  isOpen.value = false
  display.isFullscreen = true
}

function showPanel() {
  isOpen.value = false
  display.isQuiet = false
}
</script>

<template>
  <Popover v-if="isVisible" v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="quiet-timer relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-transparent text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        :class="{ 'quiet-timer-work': store.isActive && !store.isBreakPhase, 'quiet-timer-break': store.isActive && store.isBreakPhase }"
        :aria-label="`Открыть таймер: ${status}, ${time}`"
        :title="`${status} · ${time}`"
      >
        <span class="font-mono text-[11px] font-medium tabular-nums">{{ time }}</span>
        <Pause v-if="!store.isActive" :size="8" class="absolute bottom-1 text-muted-foreground" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" :side-offset="8" class="w-60">
      <div class="mb-3 flex items-center justify-between gap-3">
        <span class="text-sm text-muted-foreground">{{ status }}</span>
        <span class="font-mono text-sm tabular-nums">{{ time }}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <TimerControls />
        <Button type="button" variant="ghost" size="icon" aria-label="Открыть таймер на весь экран" title="На весь экран" @click="showFullscreen">
          <Maximize2 :size="16" />
        </Button>
      </div>
      <Button type="button" variant="ghost" class="mt-3 w-full justify-start text-muted-foreground" @click="showPanel">
        <PanelBottom :size="16" />
        Вернуть нижнюю панель
      </Button>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.quiet-timer-work {
  border-color: oklch(0.65 0.045 25 / 0.65);
}

.quiet-timer-break {
  border-color: oklch(0.65 0.035 250 / 0.65);
}
</style>

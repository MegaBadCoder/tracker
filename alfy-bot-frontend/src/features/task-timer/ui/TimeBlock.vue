<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTimerStore } from '../model/timer-store'
import { Button } from '@/components/ui/button'
import { Play, Pause, Square } from 'lucide-vue-next'

const store = useTimerStore()
const isFullscreen = ref(false)

const formattedTime = computed(() => {
  return store.formatTime(store.timeBlock)
})

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

onMounted(() => {
  store.restoreSession()
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
        'timer-block z-[1000]',
        isFullscreen
          ? 'fixed inset-0 w-full h-full p-10 bg-black/90 flex flex-col items-center justify-center z-[10000]'
          : 'fixed bottom-5 left-1/2 -translate-x-1/2 inline-flex flex-row items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-card border border-border group'
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
.phase-name {
  font-size: 24px;
  color: white;
  margin-bottom: 20px;
}

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

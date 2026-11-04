<script setup lang="ts">
import { Pause, Play, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useTimerStore } from '../model/timer-store'

const store = useTimerStore()
</script>

<template>
  <div class="flex gap-2 items-center">
    <Button
      type="button"
      variant="outline"
      size="icon"
      :aria-label="store.isActive ? 'Приостановить таймер' : 'Продолжить таймер'"
      :title="store.isActive ? 'Приостановить таймер' : 'Продолжить таймер'"
      @click="store.toggleTimer"
    >
      <Play v-if="!store.isActive" :size="16" />
      <Pause v-else :size="16" />
    </Button>
    <Button
      v-if="store.phase > 0"
      type="button"
      variant="outline"
      size="icon"
      aria-label="Завершить интервал"
      title="Завершить интервал"
      @click="store.isActive || !store.isStartTimeBlock() ? store.stopTimeBlock(true) : store.resetToInitialState()"
    >
      <Square :size="16" />
    </Button>
  </div>
</template>

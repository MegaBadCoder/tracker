<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INTERVAL_PRESETS } from './goal-create-options'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'setInterval', n: number): void
  (e: 'back'): void
}>()

const customValue = ref<string>('')

function pickPreset(n: number) {
  emit('setInterval', n)
}

function submitCustom() {
  const n = Number(customValue.value)
  if (!Number.isInteger(n) || n < 1)
    return
  emit('setInterval', n)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Через сколько дней?
    </h2>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="opt in INTERVAL_PRESETS"
        :key="opt.days"
        variant="outline"
        @click="pickPreset(opt.days)"
      >
        {{ opt.label }}
      </Button>
    </div>

    <div class="flex gap-2 items-center">
      <Input
        v-model="customValue"
        type="number"
        inputmode="numeric"
        min="1"
        placeholder="Своё значение"
        class="max-w-[160px]"
        @keydown.enter="submitCustom"
      />
      <Button :disabled="!customValue || Number(customValue) < 1" @click="submitCustom">
        Подтвердить
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
    </div>
  </div>
</template>

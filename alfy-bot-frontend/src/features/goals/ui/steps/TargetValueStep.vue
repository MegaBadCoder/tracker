<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'submitTargetValue', s?: string): void
  (e: 'back'): void
}>()

const value = ref<string>(props.state.pending.targetValue ?? '')
const error = ref<string>('')

function onSubmit() {
  const trimmed = String(value.value ?? '').trim()
  if (trimmed.length === 0) {
    error.value = 'Введи число'
    return
  }
  if (Number.isNaN(Number(trimmed))) {
    error.value = 'Введи число'
    return
  }
  error.value = ''
  emit('submitTargetValue', trimmed)
}

function onSkip() {
  error.value = ''
  emit('submitTargetValue', undefined)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Какое эталонное значение (цель)?
    </h2>
    <p class="text-sm text-muted-foreground">
      Это будет линия-ориентир на графике.
    </p>

    <Input
      v-model="value"
      type="number"
      inputmode="numeric"
      placeholder="Например: 10"
      @keydown.enter="onSubmit"
    />

    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
      <Button variant="secondary" @click="onSkip">
        Пропустить
      </Button>
      <Button :disabled="String(value ?? '').trim().length === 0" @click="onSubmit">
        Далее
      </Button>
    </div>
  </div>
</template>

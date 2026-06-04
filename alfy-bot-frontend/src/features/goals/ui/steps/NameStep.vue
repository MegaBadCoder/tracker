<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'submitName', s: string): void
  (e: 'back'): void
}>()

const name = ref<string>(props.state.goalName ?? '')

function onSubmit() {
  const trimmed = name.value.trim()
  if (trimmed.length === 0)
    return
  emit('submitName', trimmed)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Какая у тебя цель?
    </h2>

    <Input
      v-model="name"
      placeholder="Например: Прочитать 12 книг"
      @keydown.enter="onSubmit"
    />

    <div class="flex gap-2">
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
      <Button :disabled="name.trim().length === 0" @click="onSubmit">
        Далее
      </Button>
    </div>
  </div>
</template>

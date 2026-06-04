<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { numberAnswer } from '@/features/goals/lib/answer-format'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const raw = ref('')

const canSubmit = computed(() => numberAnswer(raw.value).length > 0)

function onSubmit() {
  if (!canSubmit.value)
    return
  emit('submit', numberAnswer(raw.value))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Input
      v-model="raw"
      type="number"
      inputmode="numeric"
      placeholder="Введи число"
      data-testid="number-input"
      @keydown.enter="onSubmit"
    />
    <Button
      :disabled="!canSubmit"
      size="lg"
      data-testid="number-submit"
      @click="onSubmit"
    >
      Ответить
    </Button>
  </div>
</template>

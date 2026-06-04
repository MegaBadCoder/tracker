<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { textAnswer } from '@/features/goals/lib/answer-format'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const raw = ref('')

const canSubmit = computed(() => textAnswer(raw.value).length > 0)

function onSubmit() {
  if (!canSubmit.value)
    return
  emit('submit', textAnswer(raw.value))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Textarea
      v-model="raw"
      :maxlength="200"
      rows="4"
      placeholder="Твой ответ…"
      data-testid="text-input"
    />
    <Button
      :disabled="!canSubmit"
      size="lg"
      data-testid="text-submit"
      @click="onSubmit"
    >
      Ответить
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { timeSpentAnswer } from '@/features/goals/lib/answer-format'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const store = useQuestionTypesStore()

// Лейблы диапазонов из стора; до гидрации — пусто. submit шлёт лейбл как есть.
const labels = computed(() => store.options('time_spent') as string[])

function pick(label: string) {
  emit('submit', timeSpentAnswer(label))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="label in labels"
      :key="label"
      variant="outline"
      size="lg"
      :data-testid="`time-${label}`"
      @click="pick(label)"
    >
      {{ label }}
    </Button>
  </div>
</template>

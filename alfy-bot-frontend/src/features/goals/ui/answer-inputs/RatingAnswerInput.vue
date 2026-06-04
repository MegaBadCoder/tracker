<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ratingAnswer } from '@/features/goals/lib/answer-format'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const store = useQuestionTypesStore()

// Числа 1..5 из стора; до гидрации — пусто.
const options = computed(() => store.options('rating') as number[])

function pick(n: number) {
  emit('submit', ratingAnswer(n))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="n in options"
      :key="n"
      variant="outline"
      size="lg"
      :data-testid="`rating-${n}`"
      @click="pick(n)"
    >
      {{ n }}
    </Button>
  </div>
</template>

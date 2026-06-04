<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { emojiRatingAnswer } from '@/features/goals/lib/answer-format'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const store = useQuestionTypesStore()

// Эмодзи для отрисовки кнопок из стора; до гидрации — пусто. В submit идёт 1-based индекс.
const emojis = computed(() => store.options('emoji_rating') as string[])

function pick(index0based: number) {
  emit('submit', emojiRatingAnswer(index0based + 1))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="(emoji, i) in emojis"
      :key="i"
      variant="outline"
      size="lg"
      class="text-xl"
      :data-testid="`emoji-${i}`"
      @click="pick(i)"
    >
      {{ emoji }}
    </Button>
  </div>
</template>

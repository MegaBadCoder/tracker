<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import type { QuestionType } from '@/types'
import { Button } from '@/components/ui/button'
import { QUESTION_TYPE_OPTIONS } from './question-types'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectQuestionType', t: QuestionType): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <p v-if="state.questionsToAdd.length > 0" class="text-sm text-muted-foreground">
      Добавлено вопросов: {{ state.questionsToAdd.length }}
    </p>

    <h2 class="text-lg font-semibold">
      Выбери тип вопроса:
    </h2>

    <div class="flex flex-col gap-2">
      <Button
        v-for="opt in QUESTION_TYPE_OPTIONS"
        :key="opt.type"
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectQuestionType', opt.type)"
      >
        <span class="mr-2">{{ opt.emoji }}</span>
        <span>{{ opt.label }}</span>
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
    </div>
  </div>
</template>

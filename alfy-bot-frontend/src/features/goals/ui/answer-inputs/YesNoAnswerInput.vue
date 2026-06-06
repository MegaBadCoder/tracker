<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { yesNoAnswer } from '@/features/goals/lib/answer-format'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

const store = useQuestionTypesStore()

// Лейблы «Да»/«Нет» из стора; до гидрации массив пуст → фоллбэк на дефолтные тексты.
// submit всегда шлёт "yes"/"no" (answer-format), независимо от лейблов.
const yesNoOpts = computed(() => store.options('yes_no') as string[])
const yesLabel = computed(() => yesNoOpts.value[0] ?? 'Да')
const noLabel = computed(() => yesNoOpts.value[1] ?? 'Нет')

function pick(yes: boolean) {
  emit('submit', yesNoAnswer(yes))
}
</script>

<template>
  <div class="flex gap-2">
    <Button
      variant="outline"
      size="lg"
      data-testid="yesno-yes"
      @click="pick(true)"
    >
      {{ yesLabel }}
    </Button>
    <Button
      variant="outline"
      size="lg"
      data-testid="yesno-no"
      @click="pick(false)"
    >
      {{ noLabel }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const props = defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'submitQuestionText', s: string): void
  (e: 'back'): void
}>()

const store = useQuestionTypesStore()

const text = ref<string>(props.state.pending.question ?? '')

const typeOption = computed(() =>
  props.state.pending.type ? store.byType(props.state.pending.type) ?? null : null,
)

function onSubmit() {
  const trimmed = text.value.trim()
  if (trimmed.length === 0)
    return
  emit('submitQuestionText', trimmed)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      <template v-if="typeOption">
        Напиши текст вопроса для типа "{{ typeOption.label }}":
      </template>
      <template v-else>
        Напиши текст вопроса:
      </template>
    </h2>

    <Input
      v-model="text"
      :placeholder="typeOption ? `Например: ${typeOption.example}` : ''"
      @keydown.enter="onSubmit"
    />

    <div class="flex gap-2">
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
      <Button :disabled="text.trim().length === 0" @click="onSubmit">
        Далее
      </Button>
    </div>
  </div>
</template>

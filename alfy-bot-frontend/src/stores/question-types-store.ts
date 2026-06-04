import type { QuestionTypeOption } from '@/api/question-types'
import type { QuestionType } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchQuestionTypes } from '@/api/question-types'

export const useQuestionTypesStore = defineStore('question-types', () => {
  const types = ref<QuestionTypeOption[]>([])
  const loaded = ref(false)

  const all = computed(() => types.value)

  async function load() {
    if (loaded.value)
      return
    types.value = await fetchQuestionTypes()
    loaded.value = true
  }

  function byType(t: QuestionType): QuestionTypeOption | undefined {
    return types.value.find(o => o.type === t)
  }

  function options(t: QuestionType): (string | number)[] {
    return byType(t)?.options ?? []
  }

  function label(t: QuestionType): string {
    return byType(t)?.label ?? t
  }

  return {
    types,
    loaded,
    all,
    load,
    byType,
    options,
    label,
  }
})

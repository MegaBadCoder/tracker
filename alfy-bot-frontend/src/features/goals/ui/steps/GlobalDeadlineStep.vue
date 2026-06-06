<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectDeadline', date?: Date): void
  (e: 'back'): void
}>()

const showCustom = ref(false)
const customValue = ref<string>('')

function pickCustom() {
  showCustom.value = true
}

function submitCustom() {
  if (!customValue.value)
    return
  // <input type="date"> отдаёт YYYY-MM-DD; парсим как local wall-clock
  const [y, m, d] = customValue.value.split('-').map(Number)
  if (!y || !m || !d)
    return
  const date = new Date(y, m - 1, d, 0, 0, 0, 0)
  emit('selectDeadline', date)
}

function skip() {
  emit('selectDeadline', undefined)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Задать дедлайн? (необязательно)
    </h2>
    <p class="text-sm text-muted-foreground">
      Глобальная цель может быть бессрочной — дедлайн можно не указывать.
    </p>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" @click="pickCustom">
        ✏️ Указать дату
      </Button>
      <Button variant="outline" @click="skip">
        Без дедлайна
      </Button>
    </div>

    <div v-if="showCustom" class="flex gap-2 items-center">
      <Input v-model="customValue" type="date" class="max-w-[200px]" />
      <Button :disabled="!customValue" @click="submitCustom">
        Подтвердить
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
    </div>
  </div>
</template>

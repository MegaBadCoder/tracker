<script setup lang="ts">
import type { FlowState, StartPreset } from '@/features/goals/model/use-goal-create-flow'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectStartPreset', preset: StartPreset, custom?: Date): void
  (e: 'back'): void
}>()

const showCustom = ref(false)
const customValue = ref<string>('')

function pickPreset(p: Exclude<StartPreset, 'custom'>) {
  emit('selectStartPreset', p)
}

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
  emit('selectStartPreset', 'custom', date)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Когда начинаешь?
    </h2>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" @click="pickPreset('today')">
        Сегодня
      </Button>
      <Button variant="outline" @click="pickPreset('tomorrow')">
        Завтра
      </Button>
      <Button variant="outline" @click="pickPreset('week')">
        Через неделю
      </Button>
      <Button variant="outline" @click="pickCustom">
        ✏️ Своя дата
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

<script setup lang="ts">
import type { EndPreset, FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectEndPreset', preset: EndPreset, custom?: Date): void
  (e: 'back'): void
}>()

const showCustom = ref(false)
const customValue = ref<string>('')
const error = ref<string>('')

interface EndPresetOption {
  preset: Exclude<EndPreset, 'custom'>
  label: string
}

const PRESETS: EndPresetOption[] = [
  { preset: 'week', label: 'Через неделю' },
  { preset: 'month', label: '1 мес' },
  { preset: 'three_months', label: '3 мес' },
  { preset: 'six_months', label: '6 мес' },
  { preset: 'year', label: '1 год' },
]

function pickPreset(p: Exclude<EndPreset, 'custom'>) {
  error.value = ''
  emit('selectEndPreset', p)
}

function pickCustom() {
  error.value = ''
  showCustom.value = true
}

function submitCustom() {
  if (!customValue.value)
    return
  const [y, m, d] = customValue.value.split('-').map(Number)
  if (!y || !m || !d)
    return
  const date = new Date(y, m - 1, d, 0, 0, 0, 0)
  emit('selectEndPreset', 'custom', date)
  // composable не пропустит дату <= start; покажем подсказку
  // (на успехе шаг изменится на point_a — error не успеет показаться)
  error.value = 'Дата окончания должна быть позже начала'
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      До какого числа?
    </h2>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="opt in PRESETS"
        :key="opt.preset"
        variant="outline"
        @click="pickPreset(opt.preset)"
      >
        {{ opt.label }}
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

    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>

    <div>
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
    </div>
  </div>
</template>

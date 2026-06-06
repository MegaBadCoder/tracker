<script setup lang="ts">
import type { FlowState, StartPresetKey } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft, Pencil } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { START_PRESETS } from './goal-create-options'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectStartPreset', preset: StartPresetKey, custom?: Date): void
  (e: 'back'): void
}>()

const showCustom = ref(false)
const customValue = ref<string>('')

function pickPreset(p: Exclude<StartPresetKey, 'custom'>) {
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
      <Button
        v-for="opt in START_PRESETS"
        :key="opt.key"
        variant="outline"
        @click="pickPreset(opt.key)"
      >
        {{ opt.label }}
      </Button>
      <Button variant="outline" @click="pickCustom">
        <Pencil class="size-4" />
        Своя дата
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
        <ArrowLeft class="size-4" />
        Назад
      </Button>
    </div>
  </div>
</template>

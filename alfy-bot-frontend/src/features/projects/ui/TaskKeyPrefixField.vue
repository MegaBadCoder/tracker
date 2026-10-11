<script setup lang="ts">
import { Input } from '@/components/ui/input'

/**
 * Поле «Префикс задач» agile-проекта: ввод приводится к верхнему регистру,
 * под полем — подсказка формата. Формат окончательно проверяет сервер.
 */
defineProps<{
  /** Текущее значение префикса; пустая строка — префикс не задан. */
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onUpdate(value: string | number) {
  emit('update:modelValue', String(value).toUpperCase())
}
</script>

<template>
  <div class="space-y-2">
    <label class="text-sm font-medium">Префикс задач</label>
    <Input
      :model-value="modelValue"
      placeholder="Например, ALF (необязательно)"
      class="font-mono"
      data-testid="task-key-prefix-input"
      @update:model-value="onUpdate"
    />
    <p class="text-xs text-muted-foreground">
      2–10 латинских букв и цифр, начинается с буквы
    </p>
  </div>
</template>

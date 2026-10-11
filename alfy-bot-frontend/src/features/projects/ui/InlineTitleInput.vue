<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { Input } from '@/components/ui/input'

/**
 * Инлайн-поле ввода названия эпика/истории/задачи прямо на доске.
 *
 * `placeholder` — подсказка в пустом поле; `initial` — исходное значение
 * (для переименования на месте).
 */
const props = defineProps<{
  placeholder: string
  initial?: string
}>()

/**
 * `submit` — обрезанное непустое значение по Enter.
 * `cancel` — по Esc, потере фокуса или пустому Enter.
 */
const emit = defineEmits<{
  submit: [title: string]
  cancel: []
}>()

const title = ref(props.initial ?? '')
const inputRef = ref<InstanceType<typeof Input> | null>(null)
let settled = false

function handleSubmit() {
  if (settled)
    return
  const trimmed = title.value.trim()
  settled = true
  if (trimmed)
    emit('submit', trimmed)
  else
    emit('cancel')
}

function handleCancel() {
  if (settled)
    return
  settled = true
  emit('cancel')
}

onMounted(() => {
  nextTick(() => {
    const el = inputRef.value?.$el as HTMLInputElement | undefined
    el?.focus()
  })
})
</script>

<template>
  <Input
    ref="inputRef"
    v-model="title"
    :placeholder="placeholder"
    class="h-8 text-sm"
    @keydown.enter="handleSubmit"
    @keydown.escape="handleCancel"
    @blur="handleCancel"
  />
</template>

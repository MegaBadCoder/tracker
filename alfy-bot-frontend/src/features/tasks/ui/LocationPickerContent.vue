<template>
  <div>
    <Input
      v-model="localValue"
      placeholder="Введите место"
      class="h-9 text-sm"
      @blur="$emit('update:modelValue', localValue || undefined)"
      @keyup.enter="$emit('update:modelValue', localValue || undefined)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  modelValue: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void
}>()

const localValue = ref(props.modelValue)
</script>

<template>
  <div class="flex items-start gap-3">
    <RoundCheckbox
      :model-value="completed"
      @update:model-value="$emit('toggle')"
    />

    <h3 :class="['font-medium', completed && 'line-through']">
      {{ title }}
    </h3>
  </div>
</template>

<script setup lang="ts">
import { RoundCheckbox } from '@/components/ui/roundCheckbox'

interface Props {
  title: string
  completed: boolean
}

interface Emits {
  (e: 'toggle'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

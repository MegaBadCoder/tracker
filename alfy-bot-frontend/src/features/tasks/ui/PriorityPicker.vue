<template>
  <DropdownMenuContent class="w-44" align="start">
    <DropdownMenuItem
      v-for="p in PRIORITIES"
      :key="p"
      class="cursor-pointer gap-2"
      @click="$emit('update:modelValue', p)"
    >
      <Flag :size="14" :class="getPriorityColor(p)" />
      {{ PRIORITY_LABELS[p] }}
    </DropdownMenuItem>
    <DropdownMenuItem
      v-if="modelValue"
      class="cursor-pointer gap-2 text-muted-foreground"
      @click="$emit('update:modelValue', undefined)"
    >
      <X :size="14" />
      Убрать
    </DropdownMenuItem>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { Flag, X } from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { type Priority, PRIORITY_LABELS, PRIORITIES } from '../model/constants'
import { getPriorityColor } from '../lib/priority'

defineProps<{
  modelValue: Priority | undefined
}>()

defineEmits<{
  (e: 'update:modelValue', value: Priority | undefined): void
}>()
</script>

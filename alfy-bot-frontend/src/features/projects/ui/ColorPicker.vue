<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        class="w-6 h-6 rounded-full border border-border flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-ring/20 transition-shadow"
        :style="modelValue ? { backgroundColor: modelValue } : undefined"
      >
        <Palette v-if="!modelValue" :size="12" class="text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-3" align="start">
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="color in PROJECT_COLOR_PALETTE"
          :key="color"
          class="w-6 h-6 rounded-full cursor-pointer hover:ring-2 hover:ring-ring/30 transition-shadow"
          :class="modelValue === color && 'ring-2 ring-ring'"
          :style="{ backgroundColor: color }"
          @click="$emit('update:modelValue', color)"
        />
      </div>
      <button
        v-if="modelValue"
        class="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        @click="$emit('update:modelValue', null)"
      >
        Сбросить цвет
      </button>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Palette } from 'lucide-vue-next'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PROJECT_COLOR_PALETTE } from '../model/project-color-palette'

defineProps<{
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()
</script>

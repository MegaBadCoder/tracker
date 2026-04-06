<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        class="w-8 h-8 rounded-md border border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
      >
        <component :is="currentIcon" :size="16" :style="iconColor ? { color: iconColor } : undefined" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-3" align="start">
      <div class="grid grid-cols-6 gap-1">
        <button
          v-for="name in PROJECT_ICON_LIST"
          :key="name"
          class="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
          :class="modelValue === name && 'bg-muted ring-1 ring-ring'"
          @click="$emit('update:modelValue', name)"
        >
          <component :is="iconComponents[name]" :size="16" />
        </button>
      </div>
      <button
        v-if="modelValue"
        class="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        @click="$emit('update:modelValue', null)"
      >
        Сбросить
      </button>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  FolderOpen, Star, Briefcase, Home, Book, Code, Zap, Heart,
  Target, Rocket, Globe, Music, Camera, Coffee, Lightbulb, Shield,
  Users, Palette, Gamepad2, GraduationCap, Stethoscope, Wrench,
  ShoppingCart, Plane,
} from 'lucide-vue-next'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PROJECT_ICON_LIST } from '../model/project-icon-list'

const props = defineProps<{
  modelValue: string | null
  iconColor?: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const iconComponents: Record<string, any> = {
  FolderOpen, Star, Briefcase, Home, Book, Code, Zap, Heart,
  Target, Rocket, Globe, Music, Camera, Coffee, Lightbulb, Shield,
  Users, Palette, Gamepad2, GraduationCap, Stethoscope, Wrench,
  ShoppingCart, Plane,
}

const currentIcon = computed(() => {
  if (props.modelValue && iconComponents[props.modelValue]) {
    return iconComponents[props.modelValue]
  }
  return FolderOpen
})
</script>

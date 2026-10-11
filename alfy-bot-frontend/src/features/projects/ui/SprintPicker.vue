<script setup lang="ts">
import { Zap } from 'lucide-vue-next'
import { computed } from 'vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { sprintLabel } from '../lib/sprint'
import { useSprintStore } from '../model/sprint-store'
import SprintPickerContent from './SprintPickerContent.vue'

const props = defineProps<{
  projectId: string
  modelValue: string | null
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const sprintStore = useSprintStore()

const label = computed(() => sprintLabel(sprintStore.sprintsOf(props.projectId), props.modelValue))
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        class="w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left"
        :class="!disabled && 'cursor-pointer hover:bg-muted/50'"
        :disabled="disabled"
      >
        <div class="flex items-center gap-2 mb-1">
          <Zap :size="13" class="text-muted-foreground/60" />
          <span class="text-[11px] text-muted-foreground/60 font-medium">Спринт</span>
        </div>
        <div class="text-[13px] truncate min-h-[1em]" :class="!modelValue && 'text-muted-foreground/40'">
          {{ label ?? '' }}
        </div>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <SprintPickerContent
        :project-id="projectId"
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

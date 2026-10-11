<script setup lang="ts">
import { BookMarked } from 'lucide-vue-next'
import { computed } from 'vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { groupLabel } from '../lib/group-tree'
import { useGroupStore } from '../model/group-store'
import GroupPickerContent from './GroupPickerContent.vue'

const props = defineProps<{
  projectId: string
  modelValue: string | null
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const groupStore = useGroupStore()

const label = computed(() => groupLabel(groupStore.groupsOf(props.projectId), props.modelValue))
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
          <BookMarked :size="13" class="text-muted-foreground/60" />
          <span class="text-[11px] text-muted-foreground/60 font-medium">Эпик / История</span>
        </div>
        <div class="text-[13px] truncate min-h-[1em]" :class="!modelValue && 'text-muted-foreground/40'">
          {{ label ?? '' }}
        </div>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <GroupPickerContent
        :project-id="projectId"
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

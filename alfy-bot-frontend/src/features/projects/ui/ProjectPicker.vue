<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        :class="[
          'w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left',
          !disabled && 'cursor-pointer hover:bg-muted/50',
        ]"
        :disabled="disabled"
      >
        <div class="flex items-center gap-2 mb-1">
          <FolderOpen :size="13" class="text-muted-foreground/60" />
          <span class="text-[11px] text-muted-foreground/60 font-medium">{{ pickerLabel }}</span>
        </div>
        <div class="text-[13px] truncate" :class="!selectedProject && 'text-muted-foreground/40'">
          {{ selectedProject?.title ?? nullOptionLabel }}
        </div>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-56">
      <DropdownMenuItem
        class="gap-2"
        @click="$emit('update:modelValue', null)"
      >
        <component :is="nullOptionIcon" :size="14" class="text-muted-foreground" />
        {{ nullOptionLabel }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <template v-for="node in filteredTree" :key="node.id">
        <ProjectPickerItem :node="node" :depth="0" :exclude-ids="excludeIds" @select="$emit('update:modelValue', $event)" />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen, Inbox } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '../model/project-store'
import ProjectPickerItem from './ProjectPickerItem.vue'

const props = defineProps<{
  modelValue: string | null | undefined
  disabled?: boolean
  excludeIds?: string[]
  context?: 'task' | 'parent'
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const store = useProjectStore()
const { projectTree, projectMap } = storeToRefs(store)

const selectedProject = computed(() =>
  props.modelValue ? projectMap.value.get(props.modelValue) : undefined,
)
const pickerContext = computed(() => props.context ?? 'task')
const pickerLabel = computed(() =>
  pickerContext.value === 'parent' ? 'Родительский проект' : 'Проект',
)
const nullOptionLabel = computed(() =>
  pickerContext.value === 'parent' ? 'Не назначено' : 'Все входящие',
)
const nullOptionIcon = computed(() =>
  pickerContext.value === 'parent' ? FolderOpen : Inbox,
)

const excludeSet = computed(() => new Set(props.excludeIds ?? []))

function filterTree(nodes: typeof projectTree.value): typeof projectTree.value {
  return nodes
    .filter(n => !excludeSet.value.has(n.id))
    .map(n => ({ ...n, children: filterTree(n.children) }))
}

const filteredTree = computed(() => filterTree(projectTree.value))
</script>

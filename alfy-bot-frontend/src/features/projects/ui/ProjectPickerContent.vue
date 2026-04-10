<template>
  <div class="space-y-1">
    <button
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', null)"
    >
      <component :is="nullOptionIcon" :size="14" class="text-muted-foreground" />
      {{ nullOptionLabel }}
    </button>
    <div class="h-px bg-border/40 my-1" />
    <template v-for="node in filteredTree" :key="node.id">
      <ProjectPickerContentItem :node="node" :depth="0" :exclude-ids="excludeIds" @select="$emit('update:modelValue', $event)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen, Inbox } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../model/project-store'
import ProjectPickerContentItem from './ProjectPickerContentItem.vue'

const props = defineProps<{
  modelValue: string | null | undefined
  excludeIds?: string[]
  context?: 'task' | 'parent'
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const store = useProjectStore()
const { projectTree } = storeToRefs(store)

const pickerContext = computed(() => props.context ?? 'task')
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

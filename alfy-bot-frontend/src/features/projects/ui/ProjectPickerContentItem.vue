<template>
  <button
    class="flex items-center gap-2.5 w-full py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
    :style="{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '12px' }"
    @click="$emit('select', node.id)"
  >
    <FolderOpen
      :size="14"
      :style="node.color ? { color: node.color } : undefined"
      class="shrink-0"
    />
    <span class="truncate">{{ node.title }}</span>
  </button>
  <ProjectPickerContentItem
    v-for="child in filteredChildren"
    :key="child.id"
    :node="child"
    :depth="depth + 1"
    :exclude-ids="excludeIds"
    @select="$emit('select', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen } from 'lucide-vue-next'
import type { ProjectTreeNode } from '../model/types'

const props = defineProps<{
  node: ProjectTreeNode
  depth: number
  excludeIds?: string[]
}>()

defineEmits<{
  select: [id: string]
}>()

const filteredChildren = computed(() => {
  const excluded = new Set(props.excludeIds ?? [])
  return props.node.children.filter(c => !excluded.has(c.id))
})
</script>

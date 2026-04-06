<template>
  <DropdownMenuItem
    class="gap-2"
    :style="{ paddingLeft: `${8 + depth * 16}px` }"
    @click="$emit('select', node.id)"
  >
    <FolderOpen
      :size="14"
      :style="node.color ? { color: node.color } : undefined"
      class="shrink-0"
    />
    <span class="truncate">{{ node.title }}</span>
  </DropdownMenuItem>
  <ProjectPickerItem
    v-for="child in filteredChildren"
    :key="child.id"
    :node="child"
    :depth="depth + 1"
    :exclude-ids="excludeIds"
    @select="$emit('select', $event)"
  />
</template>

<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { ProjectTreeNode } from '../model/types'

import { computed } from 'vue'

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

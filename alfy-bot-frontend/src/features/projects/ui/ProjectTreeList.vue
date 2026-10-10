<script setup lang="ts">
import draggable from 'vuedraggable'
import { useProjectStore } from '../model/project-store'
import type { ProjectTreeNode } from '../model/types'
import ProjectTreeItem from './ProjectTreeItem.vue'

const props = defineProps<{
  nodes: ProjectTreeNode[]
  depth: number
}>()

const emit = defineEmits<{
  edit: [node: ProjectTreeNode]
  createChild: [node: ProjectTreeNode]
  delete: [node: ProjectTreeNode]
  reorder: [ids: string[]]
}>()

const store = useProjectStore()

function move(index: number, offset: number) {
  const nodes = [...props.nodes]
  const target = index + offset
  if (target < 0 || target >= nodes.length) return
  const [node] = nodes.splice(index, 1)
  if (!node) return
  nodes.splice(target, 0, node)
  emit('reorder', nodes.map(item => item.id))
}
</script>

<template>
  <draggable
    :model-value="nodes"
    item-key="id"
    :animation="150"
    :disabled="store.treeBusy"
    handle=".project-drag-handle"
    ghost-class="opacity-30"
    class="flex flex-col gap-0.5"
    @update:model-value="emit('reorder', $event.map((node: ProjectTreeNode) => node.id))"
  >
    <template #item="{ element: node, index }">
      <ProjectTreeItem
        :node="node"
        :depth="depth"
        :can-move-up="index > 0"
        :can-move-down="index < nodes.length - 1"
        @move="move(index, $event)"
        @edit="emit('edit', $event)"
        @create-child="emit('createChild', $event)"
        @delete="emit('delete', $event)"
        @reorder="emit('reorder', $event)"
      />
    </template>
  </draggable>
</template>

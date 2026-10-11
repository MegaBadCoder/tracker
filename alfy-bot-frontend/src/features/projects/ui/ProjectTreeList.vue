<script setup lang="ts">
import type { ProjectTreeNode } from '../model/types'
import { computed, ref } from 'vue'
import { PROJECT_INDENT } from '../lib/project-tree-drag'
import { useProjectTreeDrag } from '../lib/use-project-tree-drag'
import { useProjectStore } from '../model/project-store'
import ProjectTreeItem from './ProjectTreeItem.vue'

const props = defineProps<{ nodes: ProjectTreeNode[], depth: number }>()
const emit = defineEmits<{
  edit: [node: ProjectTreeNode]
  createChild: [node: ProjectTreeNode]
  delete: [node: ProjectTreeNode]
  reorder: [ids: string[]]
  relocate: [id: string, parentId: string | null, beforeId: string | null]
}>()
const store = useProjectStore()
const list = ref<HTMLElement | null>(null)
const { rows, drag, destination, lineTop, start, preventDragClick } = useProjectTreeDrag(
  list,
  () => props.nodes,
  () => store.collapsedIds,
  () => store.treeBusy,
  (id, target) => emit('relocate', id, target.parentId, target.beforeId),
)
const destinationLabel = computed(() => destination.value?.parentId
  ? `Внутрь «${store.projectMap.get(destination.value.parentId)?.title}»`
  : 'На корневой уровень')

function siblings(node: ProjectTreeNode) {
  return store.projects.filter(project => project.parentId === node.parentId).sort((a, b) => a.order - b.order)
}

function move(node: ProjectTreeNode, offset: number) {
  const ids = siblings(node).map(project => project.id)
  const index = ids.indexOf(node.id)
  const target = index + offset
  if (target < 0 || target >= ids.length)
    return
  ids.splice(index, 1)
  ids.splice(target, 0, node.id)
  emit('reorder', ids)
}

function outdent(node: ProjectTreeNode) {
  const parent = node.parentId ? store.projectMap.get(node.parentId) : null
  if (!parent)
    return
  const peers = store.projects.filter(project => project.parentId === parent.parentId).sort((a, b) => a.order - b.order)
  const next = peers[peers.findIndex(project => project.id === parent.id) + 1]
  emit('relocate', node.id, parent.parentId, next?.id ?? null)
}
</script>

<template>
  <div ref="list" @click.capture="preventDragClick" class="relative flex flex-col gap-0.5 min-h-8" :class="drag?.active ? 'select-none cursor-grabbing' : ''">
    <div v-for="row in rows" :key="row.node.id" :data-tree-row="row.node.id" :class="drag?.active && drag.row.node.id === row.node.id ? 'opacity-30' : ''">
      <ProjectTreeItem
        :node="row.node"
        :depth="row.depth"
        :drag-active="drag?.active ?? false"
        :can-move-up="siblings(row.node)[0]?.id !== row.node.id"
        :can-move-down="siblings(row.node).slice(-1)[0]?.id !== row.node.id"
        @drag-start="start(row, $event)"
        @move="move(row.node, $event)"
        @outdent="outdent(row.node)"
        @edit="emit('edit', $event)"
        @create-child="emit('createChild', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
    <div
      v-if="drag?.active && destination"
      data-project-drop-indicator
      class="pointer-events-none absolute right-0 z-20 border-t-2 border-primary"
      :style="{ top: `${lineTop}px`, left: `${destination.depth * PROJECT_INDENT}px` }"
    >
      <span class="absolute right-0 bottom-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground shadow">{{ destinationLabel }}</span>
    </div>
    <Teleport to="body">
      <div v-if="drag?.active" class="pointer-events-none fixed z-[100] rounded border bg-popover px-3 py-2 text-sm shadow-lg max-w-64 truncate" :style="{ left: `${drag.x + 12}px`, top: `${drag.y + 16}px` }">
        {{ drag.row.node.title }}
      </div>
    </Teleport>
  </div>
</template>

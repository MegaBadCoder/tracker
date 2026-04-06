<template>
  <div class="px-4 mt-4">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wide">Проекты</span>
      <button
        class="p-0.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
        @click="showCreate = true"
      >
        <Plus :size="14" />
      </button>
    </div>
    <draggable
      :model-value="projectTree"
      item-key="id"
      :animation="150"
      ghost-class="opacity-30"
      class="flex flex-col gap-0.5"
      @end="handleReorder"
    >
      <template #item="{ element: node }">
        <ProjectTreeItem
          :node="node"
          :depth="0"
          @edit="handleEdit"
        />
      </template>
    </draggable>
  </div>
  <ProjectCreateDialog v-model:open="showCreate" />
  <ProjectEditDialog
    :project="editingProject"
    :open="showEdit"
    @update:open="showEdit = $event"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import { useProjectStore } from '../model/project-store'
import { storeToRefs } from 'pinia'
import ProjectTreeItem from './ProjectTreeItem.vue'
import ProjectCreateDialog from './ProjectCreateDialog.vue'
import ProjectEditDialog from './ProjectEditDialog.vue'
import type { Project, ProjectTreeNode } from '../model/types'

const showCreate = ref(false)
const showEdit = ref(false)
const editingProject = ref<Project | null>(null)

const store = useProjectStore()
const { projectTree } = storeToRefs(store)

function handleEdit(node: ProjectTreeNode) {
  editingProject.value = store.projectMap.get(node.id) ?? null
  showEdit.value = true
}

function handleReorder() {
  const orderedIds = projectTree.value.map(n => n.id)
  store.reorderProjects(orderedIds)
}
</script>

<script setup lang="ts">
import type { Project, ProjectTreeNode } from '../model/types'
import { Plus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from '@/composables/useConfirm'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useProjectStore } from '../model/project-store'
import ProjectCreateDialog from './ProjectCreateDialog.vue'
import ProjectEditDialog from './ProjectEditDialog.vue'
import ProjectTreeList from './ProjectTreeList.vue'

const showCreate = ref(false)
const showEdit = ref(false)
const parentId = ref<string | null>(null)
const editingProject = ref<Project | null>(null)
const error = ref('')
const store = useProjectStore()
const taskStore = useTaskStore()
const { projectTree } = storeToRefs(store)
const route = useRoute()
const router = useRouter()
const { confirm } = useConfirm()

function handleCreate(node: ProjectTreeNode | null) {
  parentId.value = node?.id ?? null
  if (node)
    store.collapsedIds.delete(node.id)
  showCreate.value = true
}

function handleEdit(node: ProjectTreeNode) {
  editingProject.value = store.projectMap.get(node.id) ?? null
  showEdit.value = true
}

async function handleReorder(orderedIds: string[]) {
  if (store.treeBusy)
    return
  store.treeBusy = true
  error.value = ''
  try {
    await store.reorderProjects(orderedIds)
  }
  catch {
    error.value = 'Не удалось сохранить порядок проектов. Попробуйте ещё раз.'
  }
  finally {
    store.treeBusy = false
  }
}

async function handleRelocate(id: string, parentId: string | null, beforeId: string | null) {
  if (store.treeBusy)
    return
  store.treeBusy = true
  error.value = ''
  try {
    await store.moveProject(id, parentId, beforeId)
  }
  catch {
    error.value = 'Не удалось переместить проект. Попробуйте ещё раз.'
  }
  finally {
    store.treeBusy = false
  }
}

async function handleDelete(node: ProjectTreeNode) {
  if (store.treeBusy)
    return
  const accepted = await confirm({
    title: `Удалить проект «${node.title}»?`,
    message: 'Задачи перейдут во входящие, а дочерние проекты — в корень списка. Колонки проекта будут удалены.',
    confirmText: 'Удалить',
    variant: 'destructive',
  })
  if (!accepted || store.treeBusy)
    return
  store.treeBusy = true
  error.value = ''
  try {
    await store.deleteProject(node.id)
    taskStore.tasks = taskStore.tasks.map(task => task.projectId === node.id
      ? { ...task, projectId: null, columnId: null }
      : task)
    if (route.params.projectId === node.id)
      await router.push('/tasks')
  }
  catch {
    error.value = 'Не удалось удалить проект. Попробуйте ещё раз.'
  }
  finally {
    store.treeBusy = false
  }
}
</script>

<template>
  <div class="px-4 mt-4 pb-4">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wide">Проекты</span>
      <button
        aria-label="Создать проект"
        :disabled="store.treeBusy"
        class="p-1 rounded text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
        @click="handleCreate(null)"
      >
        <Plus :size="14" />
      </button>
    </div>
    <p v-if="error" role="alert" class="text-xs text-destructive py-2">
      {{ error }}
    </p>
    <ProjectTreeList
      :nodes="projectTree"
      :depth="0"
      @edit="handleEdit"
      @create-child="handleCreate"
      @delete="handleDelete"
      @reorder="handleReorder"
      @relocate="handleRelocate"
    />
  </div>
  <ProjectCreateDialog v-model:open="showCreate" :parent-id="parentId" />
  <ProjectEditDialog
    :project="editingProject"
    :open="showEdit"
    @update:open="showEdit = $event"
  />
</template>

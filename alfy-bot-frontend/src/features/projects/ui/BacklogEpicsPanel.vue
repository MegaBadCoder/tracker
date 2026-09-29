<script setup lang="ts">
import type { BoardGroupNode } from '../model/types'
import { ChevronDown, ChevronRight, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { groupProgress } from '../lib/group-tree'
import { useGroupDeletion } from '../lib/use-group-deletion'
import { useGroupStore } from '../model/group-store'
import { useGroupDetail } from '../model/use-group-detail'
import GroupActionsMenu from './GroupActionsMenu.vue'
import InlineTitleInput from './InlineTitleInput.vue'

/**
 * Панель эпиков вкладки «Бэклог»: эпики с историями и счётчиками
 * «выполнено/всего», действия над группами и создание эпика. На узком экране
 * сворачивается кнопкой-заголовком «Эпики».
 */
const props = defineProps<{
  /** Id проекта, эпики которого показываются. */
  projectId: string
}>()

const groupStore = useGroupStore()
const taskStore = useTaskStore()
const { deleteGroupWithConfirm } = useGroupDeletion()
const groupDetail = useGroupDetail()

const expanded = ref(false)
const addingEpic = ref(false)
const renamingId = ref<string | null>(null)
const addingStoryFor = ref<string | null>(null)

const epics = computed(() => groupStore.groupsOf(props.projectId))

function counter(group: BoardGroupNode): string {
  const { done, total } = groupProgress(group, taskStore.tasks)
  return `${done}/${total}`
}

function handleOpen(id: string) {
  groupDetail.open(props.projectId, id)
}

async function handleRename(id: string, title: string) {
  renamingId.value = null
  await groupStore.updateGroup(props.projectId, id, { title })
}

async function handleSetColor(id: string, color: string | null) {
  await groupStore.updateGroup(props.projectId, id, { color })
}

async function handleCreateStory(epicId: string, title: string) {
  addingStoryFor.value = null
  await groupStore.createGroup(props.projectId, { title, parentId: epicId })
}

async function handleCreateEpic(title: string) {
  addingEpic.value = false
  await groupStore.createGroup(props.projectId, { title })
}

async function handleToggleDone(group: BoardGroupNode) {
  await groupStore.toggleGroupDone(props.projectId, group)
}

async function handleDelete(group: BoardGroupNode) {
  await deleteGroupWithConfirm(props.projectId, group)
}
</script>

<template>
  <aside class="rounded-lg border border-border bg-muted/20 md:w-60 md:shrink-0">
    <button
      class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm font-semibold md:pointer-events-none md:cursor-default"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <ChevronDown v-if="expanded" :size="16" class="md:hidden" />
      <ChevronRight v-else :size="16" class="md:hidden" />
      Эпики
    </button>

    <div class="border-t border-border px-1 py-1 md:block" :class="expanded ? 'block' : 'hidden'">
      <template v-for="epic in epics" :key="epic.id">
        <div
          v-for="group in [epic, ...epic.children]"
          :key="group.id"
          class="flex items-center gap-1.5 rounded-md py-0.5 pr-1 hover:bg-muted/50"
          :class="group.type === 'story' ? 'pl-6' : 'pl-2'"
          :data-group-id="group.id"
        >
          <span
            v-if="group.type === 'epic' && group.color"
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: group.color }"
          />
          <InlineTitleInput
            v-if="renamingId === group.id"
            :placeholder="group.type === 'epic' ? 'Название эпика' : 'Название истории'"
            :initial="group.title"
            class="min-w-0 flex-1"
            @submit="handleRename(group.id, $event)"
            @cancel="renamingId = null"
          />
          <button
            v-else
            class="min-w-0 flex-1 cursor-pointer truncate rounded text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="[group.type === 'story' && 'text-xs text-muted-foreground', group.status === 'done' && 'line-through']"
            @click="handleOpen(group.id)"
          >
            {{ group.title }}
          </button>
          <span class="shrink-0 text-xs text-muted-foreground" data-testid="group-counter">{{ counter(group) }}</span>
          <GroupActionsMenu
            :group="group"
            @open="handleOpen(group.id)"
            @rename="renamingId = group.id"
            @set-color="handleSetColor(group.id, $event)"
            @add-story="addingStoryFor = group.id"
            @toggle-done="handleToggleDone(group)"
            @delete="handleDelete(group)"
          />
        </div>
        <div v-if="addingStoryFor === epic.id" class="py-1 pl-6 pr-2">
          <InlineTitleInput
            placeholder="Название истории"
            @submit="handleCreateStory(epic.id, $event)"
            @cancel="addingStoryFor = null"
          />
        </div>
      </template>

      <p v-if="epics.length === 0 && !addingEpic" class="px-2 py-2 text-xs text-muted-foreground">
        Эпиков пока нет.
      </p>

      <div class="px-2 py-1.5">
        <button
          v-if="!addingEpic"
          class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          @click="addingEpic = true"
        >
          <Plus :size="14" />
          Эпик
        </button>
        <InlineTitleInput
          v-else
          placeholder="Название эпика"
          @submit="handleCreateEpic"
          @cancel="addingEpic = false"
        />
      </div>
    </div>
  </aside>
</template>

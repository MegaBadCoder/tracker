<script setup lang="ts">
import type { BoardGroupNode, StoryWorkflowStatus } from '../model/types'
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { apiErrorMessage } from '../lib/api-error'
import { groupProgress } from '../lib/group-tree'
import { useGroupStore } from '../model/group-store'
import { useStoryWorkflowStore } from '../model/story-workflow-store'
import { useGroupDetail } from '../model/use-group-detail'
import StoryStatusPicker from './StoryStatusPicker.vue'
import StoryWorkflowDialog from './StoryWorkflowDialog.vue'

const props = defineProps<{ projectId: string, sprintId: string | null, showCompleted: boolean }>()
const groups = useGroupStore()
const tasks = useTaskStore()
const workflow = useStoryWorkflowStore()
const detail = useGroupDetail()
const settingsOpen = ref(false)
const error = ref('')
const moving = ref(false)
const query = ref('')
const statuses = computed(() => workflow.statusesOf(props.projectId))
const stories = computed(() => groups.groupsOf(props.projectId).flatMap(epic => epic.children).filter(story => !story.archived && (props.showCompleted || story.status !== 'done')).filter(story => props.sprintId === null || story.sprintId === props.sprintId || tasks.tasks.some(t => t.groupId === story.id && t.sprintId === props.sprintId)).filter(story => story.title.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
watch(() => props.projectId, (id) => {
  groups.ensureGroups(id)
  workflow.ensure(id)
}, { immediate: true })

function inStatus(status: StoryWorkflowStatus) {
  return stories.value.filter(story => story.workflowStatusId ? story.workflowStatusId === status.id : status.id === statuses.value.find(s => s.category === (story.status === 'done' ? 'done' : 'open'))?.id)
}

async function dropped(event: { added?: { element: BoardGroupNode } }, statusId: string) {
  if (!event.added || moving.value)
    return
  moving.value = true
  error.value = ''
  try {
    await groups.updateGroup(props.projectId, event.added.element.id, { workflowStatusId: statusId })
  }
  catch (err) { error.value = apiErrorMessage(err, 'Не удалось изменить статус истории') }
  finally { moving.value = false }
}
</script>

<template>
  <section aria-label="Доска историй" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <input v-model="query" type="search" placeholder="Поиск историй по названию" aria-label="Поиск историй" class="min-h-9 rounded-md border border-input bg-background px-3 text-sm"><Button variant="outline" size="sm" @click="settingsOpen = true">
        Настроить статусы
      </Button>
    </div>
    <p v-if="error || workflow.errors[projectId]" role="alert" class="text-sm text-destructive">
      {{ error || workflow.errors[projectId] }}
    </p>
    <div class="flex gap-3 overflow-x-auto pb-3">
      <section v-for="status in statuses" :key="status.id" class="w-64 shrink-0 rounded-xl border border-border bg-muted/20">
        <h3 class="flex items-center gap-2 p-3 text-sm font-medium">
          <span class="size-2 rounded-full" :style="{ backgroundColor: status.color }" />{{ status.name }}<span class="ml-auto text-xs text-muted-foreground">{{ inStatus(status).length }}</span>
        </h3>
        <draggable :model-value="inStatus(status)" item-key="id" :group="{ name: `story-status-${projectId}` }" :sort="false" :disabled="moving" handle=".story-board-handle" class="min-h-32 space-y-2 p-2 pt-0" @change="dropped($event, status.id)">
          <template #item="{ element: story }">
            <article class="rounded-lg border border-border bg-background p-3 shadow-sm">
              <button class="story-board-handle w-full cursor-grab text-left text-sm font-medium leading-snug hover:underline" @click="detail.open(projectId, story.id)">
                {{ story.title }}
              </button>
              <p class="my-2 text-xs text-muted-foreground">
                {{ groupProgress(story, tasks.tasks).done }} из {{ groupProgress(story, tasks.tasks).total }} задач
              </p>
              <p v-if="story.blockedReason" class="mb-2 text-xs text-destructive">
                {{ story.blockedReason }}
              </p>
              <p v-if="story.dependencyIds?.some((id: string) => groups.groupsOf(projectId).flatMap(e => e.children).find(s => s.id === id)?.status !== 'done')" class="mb-2 text-xs text-muted-foreground">
                Ожидает зависимую историю
              </p>
              <StoryStatusPicker :story="story" />
              <p v-if="story.status !== 'done' && groupProgress(story, tasks.tasks).total > 0 && groupProgress(story, tasks.tasks).done === groupProgress(story, tasks.tasks).total" class="mt-2 text-xs text-muted-foreground">
                Все задачи готовы — проверьте результат истории.
              </p>
            </article>
          </template>
        </draggable>
      </section>
    </div>
    <p v-if="statuses.length && !stories.length" class="py-8 text-center text-sm text-muted-foreground">
      Историй по выбранным условиям пока нет. Добавьте историю в бэклоге.
    </p>
    <StoryWorkflowDialog v-model:open="settingsOpen" :project-id="projectId" />
  </section>
</template>

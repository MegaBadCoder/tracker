<script setup lang="ts">
import type { BacklogStory } from '../lib/backlog-stories'
import type { Sprint } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { BookOpen, ChevronDown, ChevronRight, Ellipsis, GripVertical, Plus, Rocket, SquareArrowOutUpRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '../lib/api-error'
import { releaseLabel } from '../lib/release'
import { useReleaseStore } from '../model/release-store'
import { useGroupDetail } from '../model/use-group-detail'
import BacklogTaskRow from './BacklogTaskRow.vue'
import InlineTitleInput from './InlineTitleInput.vue'
import ReleasePickerContent from './ReleasePickerContent.vue'

const props = defineProps<{
  entry: BacklogStory
  sprintId: string | null
  sprints: Sprint[]
}>()

const emit = defineEmits<{
  createTask: [groupId: string, title: string]
  openTask: [task: Task]
  toggleTask: [id: string]
  moveTask: [taskId: string, sprintId: string | null]
  moveStory: [storyId: string, sprintId: string | null]
}>()

const expanded = ref(false)
const addingTask = ref(false)
const releaseOpen = ref(false)
const savingRelease = ref(false)
const errorMessage = ref<string | null>(null)
const releaseStore = useReleaseStore()
const groupDetail = useGroupDetail()
const story = computed(() => props.entry.story)
const label = computed(() => releaseLabel(releaseStore.releasesOf(story.value.projectId), story.value.releaseId))
const released = computed(() => releaseStore.releasesOf(story.value.projectId).some(r => r.id === story.value.releaseId && r.status === 'released'))

function createTask(title: string) {
  emit('createTask', story.value.id, title)
  addingTask.value = false
}

function startAddingTask() {
  expanded.value = true
  addingTask.value = true
}

async function setRelease(releaseId: string | null) {
  releaseOpen.value = false
  savingRelease.value = true
  errorMessage.value = null
  try {
    await releaseStore.setStoryRelease(story.value.projectId, story.value.id, releaseId)
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Не удалось назначить релиз истории')
  }
  finally {
    savingRelease.value = false
  }
}

function acceptsStoryDrop(_target: unknown, source: { el: HTMLElement }) {
  return source.el.closest<HTMLElement>('[data-story-id]')?.dataset.storyId === story.value.id
}

function handleChange(event: { added?: { element: Task } }) {
  if (event.added?.element.groupId === story.value.id)
    emit('moveTask', event.added.element.id, props.sprintId)
}
</script>

<template>
  <div :data-story-id="story.id" class="rounded-md border border-border/60 bg-background/40">
    <div class="flex flex-wrap items-center gap-2 px-2 py-2">
      <button class="story-drag-handle cursor-grab rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing" :aria-label="`Перетащить историю ${story.title}`">
        <GripVertical :size="15" />
      </button>
      <button
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? 'Свернуть' : 'Раскрыть'} историю ${story.title}`"
        @click="expanded = !expanded"
      >
        <ChevronDown v-if="expanded" :size="15" class="shrink-0 text-muted-foreground" />
        <ChevronRight v-else :size="15" class="shrink-0 text-muted-foreground" />
        <BookOpen :size="14" class="shrink-0 text-primary/70" />
        <span class="truncate text-sm font-medium" :class="story.status === 'done' && 'text-muted-foreground line-through'">{{ story.title }}</span>
      </button>
      <span class="hidden max-w-32 truncate rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline" :title="entry.epic.title">{{ entry.epic.title }}</span>
      <span class="shrink-0 text-xs tabular-nums text-muted-foreground" data-testid="story-progress">{{ entry.done }}/{{ entry.total }}</span>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="`Перенести историю ${story.title}`">
            <Ellipsis :size="15" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem v-for="target in sprints.filter(s => s.id !== sprintId)" :key="target.id" @click="emit('moveStory', story.id, target.id)">
            {{ target.name }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="sprintId !== null" @click="emit('moveStory', story.id, null)">
            В бэклог
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu v-model:open="releaseOpen">
        <DropdownMenuTrigger as-child>
          <button :disabled="savingRelease || released" class="flex max-w-36 cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:cursor-default" :aria-label="`Релиз истории ${story.title}`">
            <Rocket :size="12" class="shrink-0" />
            <span class="truncate">{{ label ?? 'Загрузка релиза…' }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ReleasePickerContent :project-id="story.projectId" :model-value="story.releaseId" @update:model-value="setRelease" />
        </DropdownMenuContent>
      </DropdownMenu>
      <button class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="`Добавить задачу в историю ${story.title}`" @click="startAddingTask">
        <Plus :size="15" />
      </button>
      <button class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="`Открыть историю ${story.title}`" @click="groupDetail.open(story.projectId, story.id)">
        <SquareArrowOutUpRight :size="14" />
      </button>
    </div>
    <p v-if="errorMessage" role="alert" class="px-3 pb-2 text-xs text-destructive">
      {{ errorMessage }}
    </p>
    <div v-if="expanded" class="border-t border-border/50 pl-5">
      <draggable :model-value="entry.tasks" item-key="id" :group="{ name: 'sprint-backlog', put: acceptsStoryDrop }" :sort="false" :animation="150" ghost-class="opacity-30" class="min-h-8 p-1" @change="handleChange">
        <template #item="{ element }">
          <BacklogTaskRow :task="element" :sprints="sprints" @open="emit('openTask', $event)" @toggle="emit('toggleTask', $event)" @move="emit('moveTask', element.id, $event)" />
        </template>
      </draggable>
      <div class="px-3 pb-2">
        <p v-if="addingTask && released" class="py-1 text-xs text-muted-foreground">
          Новая задача будет без релиза. Релиз можно выбрать в её карточке.
        </p>
        <InlineTitleInput v-if="addingTask" placeholder="Название задачи в истории" @submit="createTask" @cancel="addingTask = false" />
        <button v-else class="flex cursor-pointer items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground" @click="startAddingTask">
          <Plus :size="13" /> Задача в истории
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlanningTask } from '../model/planning-types'
import type { BoardGroup } from '../model/types'
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useGroupDetail } from '../model/use-group-detail'
import StoryStatusPicker from './StoryStatusPicker.vue'

const props = defineProps<{ projectId: string, title: string, tasks: PlanningTask[], stories: BoardGroup[], busy: boolean, carryoverCounts: Record<string, number>, taskSelection: string[], storySelection: string[] }>()
const emit = defineEmits<{ 'update:taskSelection': [ids: string[]], 'update:storySelection': [ids: string[]], 'openTask': [id: string], 'reorder': [ids: string[]], 'moveStory': [story: BoardGroup, direction: -1 | 1] }>()
const detail = useGroupDetail()
const storyIds = computed(() => new Set(props.stories.map(story => story.id)))
const standalone = computed(() => props.tasks.filter(task => !task.groupId || !storyIds.value.has(task.groupId)))

function select(id: string, kind: 'task' | 'story', checked: boolean) {
  const previous = kind === 'task' ? props.taskSelection : props.storySelection
  const next = checked ? [...new Set([...previous, id])] : previous.filter(item => item !== id)
  if (kind === 'task')
    emit('update:taskSelection', next)
  else emit('update:storySelection', next)
}

function shiftTask(id: string, direction: number) {
  const ordered = [...props.tasks].sort((a, b) => a.order - b.order).map(task => task.id)
  const index = ordered.indexOf(id)
  const target = index + direction
  if (target < 0 || target >= ordered.length)
    return
  ordered.splice(index, 1)
  ordered.splice(target, 0, id)
  emit('reorder', ordered)
}

function taskPosition(id: string) {
  return [...props.tasks].sort((a, b) => a.order - b.order).findIndex(task => task.id === id)
}
</script>

<template>
  <section class="min-w-0 rounded-xl border border-border bg-background" :aria-label="title">
    <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h3 class="text-sm font-semibold">
        {{ title }}
      </h3><span class="text-xs text-muted-foreground">{{ tasks.length }} задач · {{ stories.length }} историй</span>
    </header>
    <div class="divide-y divide-border/60">
      <article v-for="story in stories" :key="story.id" class="p-3">
        <div class="flex items-start gap-2">
          <input type="checkbox" :checked="storySelection.includes(story.id)" :disabled="busy" :aria-label="`Выбрать историю ${story.title}`" class="mt-2 size-4 accent-primary" @change="select(story.id, 'story', ($event.target as HTMLInputElement).checked)">
          <div class="min-w-0 flex-1">
            <button type="button" class="py-1 text-left text-sm font-medium hover:underline" @click="detail.open(projectId, story.id)">
              {{ story.title }}<ExternalLink :size="12" class="ml-1 inline text-muted-foreground" />
            </button>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <StoryStatusPicker :story="story" /><span v-if="story.blockedReason" class="text-xs text-destructive">{{ story.blockedReason }}</span><span v-if="story.archived" class="text-xs text-muted-foreground">В архиве</span><span v-if="story.deferredUntil" class="text-xs text-muted-foreground">Отложена до {{ story.deferredUntil }}</span>
            </div>
          </div>
          <div class="flex shrink-0">
            <Button variant="ghost" size="icon-sm" :disabled="busy" :aria-label="`Поднять историю ${story.title}`" @click="emit('moveStory', story, -1)">
              <ArrowUp :size="13" />
            </Button><Button variant="ghost" size="icon-sm" :disabled="busy" :aria-label="`Опустить историю ${story.title}`" @click="emit('moveStory', story, 1)">
              <ArrowDown :size="13" />
            </Button>
          </div>
        </div>
        <ul class="mt-2 space-y-1 pl-6">
          <li v-for="task in tasks.filter(task => task.groupId === story.id)" :key="task.id" class="flex items-center gap-2 rounded-md py-1 hover:bg-muted/40">
            <input type="checkbox" :checked="taskSelection.includes(task.id)" :disabled="busy || storySelection.includes(story.id)" :aria-label="`Выбрать задачу ${task.title}`" class="size-4 shrink-0 accent-primary" @change="select(task.id, 'task', ($event.target as HTMLInputElement).checked)">
            <button class="min-w-0 flex-1 truncate text-left text-sm hover:underline" :class="task.completed && 'line-through text-muted-foreground'" @click="emit('openTask', task.id)">
              {{ task.title }}
            </button>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ task.estimateMinutes === null ? 'Без оценки' : `${task.estimateMinutes} мин` }}</span>
            <span v-if="carryoverCounts[task.id]" class="text-xs text-muted-foreground" :title="`Переносилась ${carryoverCounts[task.id]} раз`">↪ {{ carryoverCounts[task.id] }}</span>
            <Button variant="ghost" size="icon-sm" :disabled="busy || taskPosition(task.id) === 0" :aria-label="`Поднять задачу ${task.title}`" @click="shiftTask(task.id, -1)">
              <ArrowUp :size="12" />
            </Button>
            <Button variant="ghost" size="icon-sm" :disabled="busy || taskPosition(task.id) === tasks.length - 1" :aria-label="`Опустить задачу ${task.title}`" @click="shiftTask(task.id, 1)">
              <ArrowDown :size="12" />
            </Button>
          </li>
        </ul>
      </article>
      <div v-for="task in standalone" :key="task.id" class="flex items-center gap-2 p-3">
        <input type="checkbox" :checked="taskSelection.includes(task.id)" :disabled="busy" :aria-label="`Выбрать задачу ${task.title}`" class="size-4 shrink-0 accent-primary" @change="select(task.id, 'task', ($event.target as HTMLInputElement).checked)">
        <button class="min-w-0 flex-1 truncate text-left text-sm hover:underline" :class="task.completed && 'line-through text-muted-foreground'" @click="emit('openTask', task.id)">
          {{ task.title }}
        </button>
        <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ task.estimateMinutes === null ? 'Без оценки' : `${task.estimateMinutes} мин` }}</span>
        <span v-if="carryoverCounts[task.id]" class="text-xs text-muted-foreground" :title="`Переносилась ${carryoverCounts[task.id]} раз`">↪ {{ carryoverCounts[task.id] }}</span>
        <Button variant="ghost" size="icon-sm" :disabled="busy || taskPosition(task.id) === 0" :aria-label="`Поднять задачу ${task.title}`" @click="shiftTask(task.id, -1)">
          <ArrowUp :size="12" />
        </Button>
        <Button variant="ghost" size="icon-sm" :disabled="busy || taskPosition(task.id) === tasks.length - 1" :aria-label="`Опустить задачу ${task.title}`" @click="shiftTask(task.id, 1)">
          <ArrowDown :size="12" />
        </Button>
      </div>
    </div>
    <p v-if="!tasks.length && !stories.length" class="px-4 py-10 text-center text-sm text-muted-foreground">
      Нет элементов по выбранным условиям
    </p>
  </section>
</template>

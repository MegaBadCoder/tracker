<script setup lang="ts">
import type { SprintMapDependency } from '../lib/sprint-map-dependencies'
import type { Task } from '@/features/tasks/model/types'
import { Check, Crosshair, ExternalLink, GitBranch, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { taskLinkPath } from '@/features/tasks/lib/task-link'

const props = defineProps<{ links: SprintMapDependency[], selectedTitle: string | null, projectId: string, showAll: boolean }>()
const emit = defineEmits<{ reveal: [taskId: string], close: [] }>()

function location(task: Task | null, onMap: boolean, hidden: boolean): string {
  if (!task)
    return 'Задача недоступна'
  if (hidden)
    return 'Скрыта в ветке'
  if (onMap)
    return 'На карте'
  if (task.projectId !== props.projectId)
    return task.projectId ? 'Другой проект' : 'Входящие'
  return task.sprintId ? 'Другой спринт' : 'Бэклог · вне спринта'
}
</script>

<template>
  <aside class="max-h-52 shrink-0 overflow-y-auto border-t border-border bg-card p-3 sm:max-h-64" aria-label="Зависимости задач">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="flex items-center gap-1.5 text-xs font-semibold">
          <GitBranch class="size-3.5 shrink-0 text-primary" />{{ showAll ? 'Все связи спринта' : 'Связи задачи' }}
        </h2>
        <p v-if="selectedTitle && !showAll" class="mt-1 truncate text-sm" :title="selectedTitle">
          {{ selectedTitle }}
        </p>
        <p class="mt-1 text-[11px] text-muted-foreground">
          Предшественник → зависимая задача · пунктир — зависимость · ✓ — готово
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Закрыть связи задач" @click="emit('close')">
        <X class="size-3.5" />
      </Button>
    </div>
    <p v-if="!links.length" role="status" class="py-1 text-xs text-muted-foreground">
      Зависимостей нет
    </p>
    <ul v-else class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="link in links" :key="`${link.dependencyId}-${link.taskId}`" class="min-w-0 rounded-lg border border-border px-2.5 py-2 text-xs">
        <div class="mb-1.5 flex items-center gap-1 text-[10px] font-medium" :class="link.completed ? 'text-muted-foreground' : 'text-primary'">
          <Check v-if="link.completed" class="size-3" />{{ link.completed ? 'Готово' : 'Ожидает предшественника' }}
        </div>
        <div v-for="endpoint in [{ task: link.predecessor, id: link.dependencyId, visible: !!link.from, hidden: link.predecessorHidden, label: 'Предшественник' }, { task: link.dependent, id: link.taskId, visible: !!link.to, hidden: link.dependentHidden, label: 'Зависит от него' }]" :key="endpoint.id" class="flex items-center gap-1.5 py-1">
          <div class="min-w-0 flex-1">
            <span class="block text-[10px] text-muted-foreground">{{ endpoint.label }}</span>
            <a v-if="endpoint.task && taskLinkPath(endpoint.id)" :href="taskLinkPath(endpoint.id)!" class="block truncate rounded font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" :aria-label="`Открыть задачу: ${endpoint.task.title}`" :title="endpoint.task.title">{{ endpoint.task.title }}</a>
            <span v-else class="block truncate font-medium">{{ endpoint.task?.title ?? 'Задача недоступна' }}</span>
            <span class="text-[10px] text-muted-foreground">{{ location(endpoint.task, endpoint.visible, endpoint.hidden) }}</span>
          </div>
          <Button v-if="endpoint.visible" variant="ghost" size="icon-sm" :aria-label="`Показать на карте: ${endpoint.task?.title}`" @click="emit('reveal', endpoint.id)">
            <Crosshair class="size-3.5" />
          </Button>
          <ExternalLink v-else class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </li>
    </ul>
  </aside>
</template>

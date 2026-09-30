<script setup lang="ts">
import type { Sprint } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { Ellipsis, MoveRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RoundCheckbox } from '@/components/ui/roundCheckbox'
import { groupPath } from '../lib/group-tree'
import { taskKey } from '../lib/task-key'
import { useColumnStore } from '../model/column-store'
import { useGroupStore } from '../model/group-store'
import { useProjectStore } from '../model/project-store'

/**
 * Строка задачи на вкладке «Бэклог»: отметка выполнения, название, метка
 * эпика/истории, колонка доски как бейдж и меню переноса в спринт.
 */
const props = defineProps<{
  task: Task
  /** Спринты, куда можно перенести задачу: активный и запланированные. Закрытые не передаются. */
  sprints: Sprint[]
}>()

const emit = defineEmits<{
  /** Клик по строке. */
  open: [task: Task]
  /** Смена отметки выполнения. */
  toggle: [id: string]
  /** Выбран пункт «В спринт…»: id спринта или `null` для бэклога. */
  move: [sprintId: string | null]
}>()

const groupStore = useGroupStore()
const columnStore = useColumnStore()
const projectStore = useProjectStore()

const key = computed(() =>
  taskKey(props.task.projectId ? projectStore.projectMap.get(props.task.projectId) : undefined, props.task),
)

const currentSprintId = computed(() => props.task.sprintId ?? null)

const epicLabel = computed(() => {
  if (!props.task.projectId || !props.task.groupId)
    return null
  return groupPath(groupStore.groupsOf(props.task.projectId), props.task.groupId)
})

const columnTitle = computed(() => {
  const columnId = props.task.columnId
  return columnId ? (columnStore.columnMap.get(columnId)?.title ?? null) : null
})
</script>

<template>
  <div
    :data-task-id="task.id"
    role="button"
    tabindex="0"
    class="group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="emit('open', task)"
    @keydown.enter.self="emit('open', task)"
  >
    <RoundCheckbox
      :model-value="task.completed"
      :disabled="task.isOverdue"
      :overdue="task.isOverdue"
      class="shrink-0"
      @click.stop
      @update:model-value="emit('toggle', task.id)"
    />
    <span
      v-if="key"
      data-testid="task-key"
      class="shrink-0 text-[11px] font-mono text-muted-foreground"
    >
      {{ key }}
    </span>
    <span
      class="min-w-0 flex-1 basis-40 truncate text-sm"
      :class="task.completed ? 'text-muted-foreground line-through' : 'text-foreground'"
    >
      {{ task.title }}
    </span>
    <span
      v-if="epicLabel"
      data-testid="epic-label"
      class="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span
        v-if="epicLabel.epic.color"
        class="h-2 w-2 shrink-0 rounded-full"
        :style="{ backgroundColor: epicLabel.epic.color }"
      />
      <span class="truncate">{{ epicLabel.epic.title }}</span>
      <template v-if="epicLabel.story">
        <span class="shrink-0">›</span>
        <span class="truncate">{{ epicLabel.story.title }}</span>
      </template>
    </span>
    <Badge
      v-if="columnTitle"
      data-testid="column-badge"
      variant="outline"
      class="h-5 shrink-0 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground"
    >
      {{ columnTitle }}
    </Badge>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Действия с задачей"
          @click.stop
        >
          <Ellipsis :size="16" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoveRight :size="14" class="mr-2" />
            В спринт…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuCheckboxItem
              :model-value="currentSprintId === null"
              :disabled="currentSprintId === null"
              @select="emit('move', null)"
            >
              Бэклог
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              v-for="sprint in sprints"
              :key="sprint.id"
              :model-value="currentSprintId === sprint.id"
              :disabled="currentSprintId === sprint.id"
              @select="emit('move', sprint.id)"
            >
              {{ sprint.name }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

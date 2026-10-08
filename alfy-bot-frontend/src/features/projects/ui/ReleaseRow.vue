<script setup lang="ts">
import type { BoardGroupNode, Release } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { ChevronRight, Ellipsis, Pencil, Rocket, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/features/tasks/lib/formatters'
import { cn } from '@/lib/utils'
import { groupReleaseTasks, isReleaseOverdue, releaseProgress } from '../lib/release'
import { parseLocalDate } from '../lib/sprint'
import { taskKey } from '../lib/task-key'
import { useGroupStore } from '../model/group-store'
import { useProjectStore } from '../model/project-store'

/**
 * Строка релиза на вкладке «Релизы»: название, даты, прогресс и метка
 * «Просрочен» в шапке; по клику на шапку раскрывается список задач релиза,
 * сгруппированных по эпикам и историям. Меню «Изменить»/«Выпустить»/«Удалить»
 * есть только у запланированного релиза и лишь эмитит события.
 */
const props = defineProps<{
  /** Id проекта релиза (по нему берётся дерево эпиков для подписей групп). */
  projectId: string
  /** Релиз строки. */
  release: Release
  /** Задачи этого релиза; у выпущенного релиза это итоговый состав. */
  tasks: Task[]
}>()

const emit = defineEmits<{
  /** Выбран пункт «Изменить». */
  edit: []
  /** Выбран пункт «Выпустить». */
  release: []
  /** Выбран пункт «Удалить». */
  delete: []
  /** Клик по задаче в раскрытом списке. */
  openTask: [task: Task]
}>()

const groupStore = useGroupStore()
const projectStore = useProjectStore()

const expanded = ref(false)
const keepFocusOnClose = ref(false)

const isPlanned = computed(() => props.release.status === 'planned')
const progress = computed(() => releaseProgress(props.tasks, props.release.id))
const progressPercent = computed(() =>
  progress.value.total === 0 ? 0 : Math.round((progress.value.done / progress.value.total) * 100),
)
const overdue = computed(() => isReleaseOverdue(props.release, new Date()))
const buckets = computed(() => groupReleaseTasks(props.tasks, groupStore.groupsOf(props.projectId), props.release.id))

const dates = computed(() => {
  const { startDate, releaseDate } = props.release
  const start = startDate ? formatDate(parseLocalDate(startDate), 'd MMM') : null
  const end = releaseDate ? formatDate(parseLocalDate(releaseDate), 'd MMM') : null
  if (start && end)
    return `с ${start} по ${end}`
  if (end)
    return `до ${end}`
  if (start)
    return `с ${start}`
  return null
})

const releasedText = computed(() =>
  props.release.releasedAt ? `Выпущен ${formatDate(new Date(props.release.releasedAt), 'd MMM')}` : null,
)

function keyOf(task: Task): string | null {
  return taskKey(projectStore.projectMap.get(props.projectId), task)
}

function bucketCaption(epic: BoardGroupNode | null, story: BoardGroupNode | null): string {
  if (!epic)
    return 'Без эпика'
  return story ? `${epic.title} › ${story.title}` : epic.title
}

function handleEdit() {
  keepFocusOnClose.value = true
  emit('edit')
}

function handleRelease() {
  keepFocusOnClose.value = true
  emit('release')
}

function onCloseAutoFocus(event: Event) {
  if (!keepFocusOnClose.value)
    return
  keepFocusOnClose.value = false
  event.preventDefault()
}
</script>

<template>
  <section class="rounded-lg border border-border bg-muted/20" :data-release-id="release.id">
    <header class="flex items-center gap-1 px-1">
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="expanded"
        :aria-label="`Релиз ${release.name}`"
        @click="expanded = !expanded"
      >
        <ChevronRight :size="14" :class="cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')" />
        <span class="text-sm font-semibold">{{ release.name }}</span>
        <span v-if="dates" class="text-xs text-muted-foreground" data-testid="release-dates">{{ dates }}</span>
        <span v-if="releasedText" class="text-xs text-muted-foreground" data-testid="release-released">{{ releasedText }}</span>
        <Badge v-if="overdue" variant="destructive" data-testid="release-overdue">
          Просрочен
        </Badge>
        <span class="text-xs text-muted-foreground" data-testid="release-counter">{{ progress.done }} из {{ progress.total }} готово</span>
        <span
          class="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progressPercent"
          aria-label="Прогресс релиза"
        >
          <span class="block h-full rounded-full bg-primary" :style="{ width: `${progressPercent}%` }" />
        </span>
      </button>
      <DropdownMenu v-if="isPlanned">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Действия с релизом"
          >
            <Ellipsis :size="16" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" @close-auto-focus="onCloseAutoFocus">
          <DropdownMenuItem @click="handleEdit">
            <Pencil :size="14" class="mr-2" />
            Изменить
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleRelease">
            <Rocket :size="14" class="mr-2" />
            Выпустить
          </DropdownMenuItem>
          <DropdownMenuItem
            class="text-destructive focus:text-destructive focus:bg-destructive/10"
            @click="emit('delete')"
          >
            <Trash2 :size="14" class="mr-2" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div v-if="expanded" class="border-t border-border p-2" data-testid="release-tasks">
      <p v-if="buckets.length === 0" class="px-2 py-2 text-xs text-muted-foreground">
        В релизе нет задач.
      </p>
      <div v-for="(bucket, index) in buckets" :key="index" class="mb-2 last:mb-0" data-testid="release-bucket">
        <p class="px-2 py-1 text-xs font-medium text-muted-foreground" data-testid="release-bucket-caption">
          {{ bucketCaption(bucket.epic, bucket.story) }}
        </p>
        <button
          v-for="task in bucket.tasks"
          :key="task.id"
          type="button"
          :data-task-id="task.id"
          class="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="task.completed ? 'text-muted-foreground line-through' : 'text-foreground'"
          @click="emit('openTask', task)"
        >
          <span
            v-if="keyOf(task)"
            data-testid="task-key"
            class="mr-2 shrink-0 text-[11px] font-mono text-muted-foreground"
          >
            {{ keyOf(task) }}
          </span>
          <span class="truncate">{{ task.title }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

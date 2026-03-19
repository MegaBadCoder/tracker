<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="flex flex-col gap-0 p-0 max-w-3xl h-[95vh] overflow-hidden [&>button:last-child]:hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <div class="flex items-center gap-2.5">
          <RoundCheckbox
            :model-value="task?.completed"
            :disabled="!editable"
            class="shrink-0"
            @update:model-value="editable && task && emitUpdate({ completed: !task.completed })"
          />
          <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FolderOpen :size="11" />
            Все входящие
          </span>
        </div>
        <div class="flex items-center gap-0.5">
          <DropdownMenu v-if="editable">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground">
                <EllipsisVertical :size="16" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                class="text-destructive focus:text-destructive focus:bg-destructive/10"
                @click="$emit('delete', task!.id)"
              >
                <Trash2 :size="14" class="mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground">
              <X :size="16" />
            </Button>
          </DialogClose>
        </div>
      </div>

      <!-- Body -->
      <div v-if="task" class="flex flex-col sm:flex-row overflow-hidden flex-1 min-h-0">
        <!-- Main content -->
        <div class="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          <!-- Title -->
          <ContentEditableInput
            ref="titleRef"
            v-model="localTitle"
            :editable="editable"
            placeholder="Без названия"
            :class="[
              'text-xl font-semibold rounded-md transition-colors',
              task.completed && 'line-through text-muted-foreground',
              editable && 'cursor-text',
            ]"
            aria-label="Название задачи"
            @blur="commitTitle"
            @keydown.enter.prevent="titleRef?.el?.blur()"
            @keydown.escape="cancelEditTitle"
          />

          <!-- Description -->
          <ContentEditableInput
            ref="descriptionRef"
            v-model="localDescription"
            :editable="editable"
            multiline
            placeholder="Добавить описание..."
            :class="[
              'text-sm leading-relaxed rounded-md py-1 transition-colors empty:before:italic',
              localDescription ? 'text-foreground/80' : '',
              editable && 'cursor-text',
            ]"
            aria-label="Описание задачи"
            @blur="commitDescription"
            @keydown.escape="cancelEditDescription"
          />

          <!-- Pomodoro section -->
          <div v-if="task.isPomodoroTask" class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-7 h-7 rounded-md bg-red-50 dark:bg-red-500/10">
                <Timer :size="14" class="text-red-500" />
              </div>
              <span class="text-sm font-medium">Помодоро</span>
              <span class="ml-auto text-xs tabular-nums text-muted-foreground">
                {{ formatPomodoro(task.pomodoroCompleted || 0) }}/{{ localPomodoroCount }}
              </span>
            </div>
            <PomodoroSettings
              :count="localPomodoroCount"
              :duration="localPomodoroDuration"
              :short-break="localShortBreak"
              :long-break="localLongBreak"
              :long-break-interval="localLongBreakInterval"
              :editable="editable"
              @update:count="localPomodoroCount = $event"
              @update:duration="localPomodoroDuration = $event"
              @update:short-break="localShortBreak = $event"
              @update:long-break="localLongBreak = $event"
              @update:long-break-interval="localLongBreakInterval = $event"
              @blur="emitPomodoroUpdate"
            />
          </div>

          <!-- Checklist -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-foreground/90">Чеклист</span>
              <span v-if="localChecklist.length > 0" class="text-[11px] tabular-nums text-muted-foreground">
                {{ checklistCompleted }} из {{ localChecklist.length }}
              </span>
            </div>

            <!-- Progress bar -->
            <div v-if="localChecklist.length > 0" class="h-1 bg-muted rounded-full overflow-hidden">
              <div
                :class="[
                  'h-full rounded-full transition-all duration-300',
                  checklistProgress === 100 ? 'bg-green-500' : 'bg-primary',
                ]"
                :style="{ width: `${checklistProgress}%` }"
              />
            </div>

            <!-- Items -->
            <div class="space-y-0.5">
              <div
                v-for="item in sortedChecklist"
                :key="item.id"
                class="group flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  :model-value="item.completed"
                  :disabled="!editable"
                  class="shrink-0"
                  @update:model-value="editable && toggleChecklistItem(item.id)"
                />
                <span
                  v-if="!editable"
                  :class="[
                    'text-sm flex-1 transition-colors',
                    item.completed && 'line-through text-muted-foreground'
                  ]"
                >
                  {{ item.text }}
                </span>
                <input
                  v-else
                  :value="item.text"
                  :class="[
                    'text-sm flex-1 bg-transparent border-none outline-none transition-colors',
                    item.completed && 'line-through text-muted-foreground'
                  ]"
                  @blur="updateChecklistItemText(item.id, ($event.target as HTMLInputElement).value)"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <button
                  v-if="editable"
                  class="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground"
                  @click="removeChecklistItem(item.id)"
                >
                  <X :size="14" />
                </button>
              </div>
            </div>

            <!-- Add new item -->
            <div v-if="editable" class="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Plus :size="14" class="text-muted-foreground/60 shrink-0" />
              <input
                v-model="newChecklistItem"
                class="text-sm bg-transparent border-none outline-none flex-1 placeholder:text-muted-foreground/50"
                placeholder="Добавить пункт..."
                @keydown.enter="addChecklistItem"
              />
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="sm:w-60 shrink-0 border-t sm:border-t-0 sm:border-l border-border/60 overflow-y-auto bg-muted/30">
          <!-- Проект (mock) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <FolderOpen :size="13" class="text-muted-foreground/60" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Проект</span>
                </div>
                <div class="text-[13px] truncate">Все входящие</div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-48">
              <div class="p-3 text-xs text-muted-foreground">Все входящие</div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Срок (dueDate) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <CalendarIcon :size="13" class="text-muted-foreground/60" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Срок</span>
                </div>
                <div :class="['text-[13px] truncate', URGENCY_CLASSES[getDueDateUrgency(localDueDate)] || (localDueDate ? '' : 'text-muted-foreground/40')]">
                  {{ localDueDate ? formatDate(localDueDate, 'd MMM yyyy') : 'Не задано' }}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-auto p-0" align="start">
              <Calendar v-model="localDueDate as any" />
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Дедлайн -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <Clock :size="13" class="text-muted-foreground/60" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Дедлайн</span>
                </div>
                <div :class="['text-[13px] truncate', localDeadline ? '' : 'text-muted-foreground/40']">
                  {{ localDeadline ? formatDate(localDeadline, 'd MMM, HH:mm') : 'Не задано' }}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DeadlinePicker
              :model-value="localDeadline"
              @update:model-value="localDeadline = $event"
            />
          </DropdownMenu>

          <!-- Приоритет -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <Flag :size="13" :class="localPriority ? getPriorityColor(localPriority) : 'text-muted-foreground/60'" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Приоритет</span>
                </div>
                <div :class="['text-[13px] truncate', localPriority ? '' : 'text-muted-foreground/40']">
                  {{ localPriority ? PRIORITY_LABELS[localPriority] : 'Не задано' }}
                </div>
              </button>
            </DropdownMenuTrigger>
            <PriorityPicker
              :model-value="localPriority"
              @update:model-value="localPriority = $event; emitUpdate({ priority: $event })"
            />
          </DropdownMenu>

          <!-- Место -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <MapPin :size="13" class="text-muted-foreground/60" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Место</span>
                </div>
                <div :class="['text-[13px] truncate', localLocation ? '' : 'text-muted-foreground/40']">
                  {{ localLocation || 'Не задано' }}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56" align="start">
              <div class="p-3">
                <Input
                  v-model="localLocation"
                  placeholder="Введите место"
                  class="h-8 text-sm"
                  @blur="emitUpdate({ location: localLocation || undefined })"
                  @keyup.enter="emitUpdate({ location: localLocation || undefined })"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Теги -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <Tag :size="13" class="text-muted-foreground/60" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Теги</span>
                </div>
                <div>
                  <div v-if="localTags.length > 0" class="flex flex-wrap gap-1">
                    <Badge
                      v-for="tag in localTags"
                      :key="tag"
                      variant="secondary"
                      class="text-[10px] px-1.5 py-0 font-normal"
                    >
                      {{ tag }}
                    </Badge>
                  </div>
                  <span v-else class="text-[13px] text-muted-foreground/40">Не задано</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-64" align="start">
              <TagsEditor
                :model-value="localTags"
                :editable="editable"
                @update:model-value="localTags = $event; emitUpdate({ tags: [...$event] })"
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Повторение (mock) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <Repeat :size="13" class="text-muted-foreground/40" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Повторение</span>
                </div>
                <div class="text-[13px] text-muted-foreground/40">Нет</div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-48">
              <div class="p-3 text-xs text-muted-foreground">Скоро</div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Напоминание (mock) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', editable && 'cursor-pointer hover:bg-muted/50']" :disabled="!editable">
                <div class="flex items-center gap-2 mb-1">
                  <Bell :size="13" class="text-muted-foreground/40" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Напоминание</span>
                </div>
                <div class="text-[13px] text-muted-foreground/40">Нет</div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-48">
              <div class="p-3 text-xs text-muted-foreground">Скоро</div>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X,
  EllipsisVertical,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  Flag,
  MapPin,
  Tag,
  Timer,
  FolderOpen,
  Plus,
  Bell,
  Repeat,
} from 'lucide-vue-next'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { ContentEditableInput } from '@/components/ui/content-editable-input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { RoundCheckbox } from '@/components/ui/roundCheckbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate, formatPomodoro } from '../lib/formatters'
import type { Priority } from '../model/types'
import { PRIORITY_LABELS, POMODORO_DEFAULTS } from '../model/constants'
import { getPriorityColor } from '../lib/priority'
import { type DueDateUrgency, getDueDateUrgency } from '../lib/urgency'
import { createChecklistItem, computeChecklistProgress } from '../lib/checklist'

const URGENCY_CLASSES: Record<DueDateUrgency, string> = {
  overdue: 'text-red-500',
  soon: 'text-yellow-600 dark:text-yellow-500',
  normal: '',
  none: '',
}
import type { Task, ChecklistItem } from '../model/types'
import TagsEditor from './TagsEditor.vue'
import PriorityPicker from './PriorityPicker.vue'
import DeadlinePicker from './DeadlinePicker.vue'
import PomodoroSettings from './PomodoroSettings.vue'

const props = withDefaults(defineProps<{
  task: Task | null
  open: boolean
  editable?: boolean
}>(), {
  editable: true,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'delete', id: string): void
  (e: 'update', task: Task): void
  (e: 'update:checklist', taskId: string, items: ChecklistItem[]): void
  (e: 'update:pomodoroConfig', taskId: string, config: {
    pomodoroCount: number
    pomodoroDuration: number
    shortBreak: number
    longBreak: number
    longBreakInterval: number
  }): void
}>()

// Contenteditable refs
const titleRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const descriptionRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const localTitle = ref('')
const localDescription = ref('')

// Checklist state
const localChecklist = ref<ChecklistItem[]>([])
const newChecklistItem = ref('')

// Sidebar field refs
const localDueDate = ref<Date | undefined>()
const localDeadline = ref<Date | undefined>()
const localPriority = ref<Priority | undefined>()
const localLocation = ref('')
const localTags = ref<string[]>([])

// Pomodoro refs
const localPomodoroCount = ref(POMODORO_DEFAULTS.count)
const localPomodoroDuration = ref(POMODORO_DEFAULTS.duration)
const localShortBreak = ref(POMODORO_DEFAULTS.shortBreak)
const localLongBreak = ref(POMODORO_DEFAULTS.longBreak)
const localLongBreakInterval = ref(POMODORO_DEFAULTS.longBreakInterval)

// Sync local state when task changes
watch(() => props.task, (task) => {
  if (task) {
    localTitle.value = task.title
    localDescription.value = task.description || ''
    localChecklist.value = task.checklist?.items
      ? task.checklist.items.map(item => ({ ...item }))
      : []
    localDueDate.value = task.dueDate
    localDeadline.value = task.deadline
    localPriority.value = task.priority
    localLocation.value = task.location || ''
    localTags.value = task.tags ? [...task.tags] : []
    localPomodoroCount.value = task.pomodoroCount ?? POMODORO_DEFAULTS.count
    localPomodoroDuration.value = task.pomodoroDuration ?? POMODORO_DEFAULTS.duration
    localShortBreak.value = task.shortBreak ?? POMODORO_DEFAULTS.shortBreak
    localLongBreak.value = task.longBreak ?? POMODORO_DEFAULTS.longBreak
    localLongBreakInterval.value = task.longBreakInterval ?? POMODORO_DEFAULTS.longBreakInterval
  }
}, { immediate: true })

// Watch sidebar fields for auto-emit
watch(localDueDate, (val) => {
  emitUpdate({ dueDate: val })
})

watch(localDeadline, (val) => {
  emitUpdate({ deadline: val })
})

// Pomodoro
function emitPomodoroUpdate() {
  if (!props.task) return
  emit('update:pomodoroConfig', props.task.id, {
    pomodoroCount: localPomodoroCount.value,
    pomodoroDuration: localPomodoroDuration.value,
    shortBreak: localShortBreak.value,
    longBreak: localLongBreak.value,
    longBreakInterval: localLongBreakInterval.value,
  })
}

// Title
function commitTitle() {
  if (props.task && localTitle.value !== props.task.title) {
    emitUpdate({ title: localTitle.value })
  }
}

function cancelEditTitle() {
  localTitle.value = props.task?.title || ''
  titleRef.value?.el?.blur()
}

// Description
function commitDescription() {
  if (props.task && localDescription.value !== (props.task.description || '')) {
    emitUpdate({ description: localDescription.value })
  }
}

function cancelEditDescription() {
  localDescription.value = props.task?.description || ''
  descriptionRef.value?.el?.blur()
}

// Checklist
const sortedChecklist = computed(() =>
  [...localChecklist.value].sort((a, b) => a.order - b.order)
)

const checklistStats = computed(() => computeChecklistProgress(localChecklist.value))
const checklistCompleted = computed(() => checklistStats.value.completed)
const checklistProgress = computed(() => checklistStats.value.progress)

function toggleChecklistItem(id: string) {
  const item = localChecklist.value.find(i => i.id === id)
  if (item) {
    item.completed = !item.completed
    emitChecklistUpdate()
  }
}

function updateChecklistItemText(id: string, text: string) {
  const item = localChecklist.value.find(i => i.id === id)
  if (item && text.trim()) {
    item.text = text.trim()
    emitChecklistUpdate()
  }
}

function removeChecklistItem(id: string) {
  localChecklist.value = localChecklist.value.filter(i => i.id !== id)
  emitChecklistUpdate()
}

function addChecklistItem() {
  const text = newChecklistItem.value.trim()
  if (!text) return

  localChecklist.value.push(createChecklistItem(text, localChecklist.value))
  newChecklistItem.value = ''
  emitChecklistUpdate()
}

function emitChecklistUpdate() {
  if (!props.task) return
  const items = localChecklist.value.map(i => ({ ...i }))
  emit('update:checklist', props.task.id, items)
}

function emitUpdate(partial: Partial<Task>) {
  if (!props.task) return
  emit('update', { ...props.task, ...partial })
}
</script>

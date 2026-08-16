<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent :class="[
      'flex flex-col gap-0 p-0 overflow-hidden [&>button:last-child]:hidden',
      isMobile
        ? 'inset-0 h-[100dvh] w-full max-w-none rounded-none translate-x-0 translate-y-0 left-0 top-0 border-0'
        : 'max-w-3xl h-[95vh]',
    ]">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <div class="flex items-center gap-2.5">
          <RoundCheckbox
            :model-value="task?.completed"
            :disabled="!effectiveEditable"
            class="shrink-0"
            @update:model-value="effectiveEditable && task && emitUpdate({ completed: !task.completed })"
          />
          <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FolderOpen :size="11" />
            {{ localProjectId ? projectStore.projectMap.get(localProjectId)?.title ?? 'Проект' : 'Все входящие' }}
          </span>
        </div>
        <div class="flex items-center gap-0.5">
          <DropdownMenu v-if="effectiveEditable">
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
            :editable="effectiveEditable"
            placeholder="Без названия"
            :class="[
              'text-xl font-semibold rounded-md transition-colors',
              task.completed && 'line-through text-muted-foreground',
              effectiveEditable && 'cursor-text',
            ]"
            aria-label="Название задачи"
            @blur="commitTitle"
            @keydown.enter.prevent="titleRef?.el?.blur()"
            @keydown.escape="cancelEditTitle"
          />

          <!-- Description -->
          <div class="space-y-1.5">
            <div
              :class="[
                'relative overflow-hidden transition-[max-height] duration-200',
                !descriptionExpanded && !descriptionFocused && descriptionOverflows
                  ? 'max-h-[calc(0.875rem*1.625*10+0.5rem)]'
                  : 'max-h-none',
              ]"
            >
              <ContentEditableInput
                ref="descriptionRef"
                v-model="localDescription"
                :editable="effectiveEditable"
                multiline
                placeholder="Добавить описание..."
                :class="[
                  'text-sm leading-relaxed rounded-md py-1 transition-colors empty:before:italic',
                  localDescription ? 'text-foreground/80' : '',
                  effectiveEditable && 'cursor-text',
                ]"
                aria-label="Описание задачи"
                @focus="descriptionFocused = true"
                @blur="onDescriptionBlur"
                @keydown.escape="cancelEditDescription"
              />
              <div
                v-if="!descriptionExpanded && !descriptionFocused && descriptionOverflows"
                class="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent"
              />
            </div>
            <button
              v-if="descriptionOverflows && !descriptionFocused"
              type="button"
              class="text-xs text-primary hover:underline cursor-pointer"
              @click="descriptionExpanded = !descriptionExpanded"
            >
              {{ descriptionExpanded ? 'Свернуть' : 'Подробнее' }}
            </button>
          </div>

          <!-- Pomodoro section -->
          <div v-if="task.isPomodoroTask || effectiveEditable" class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-7 h-7 rounded-md bg-red-50 dark:bg-red-500/10">
                <Timer :size="14" class="text-red-500" />
              </div>
              <span class="text-sm font-medium">Помодоро</span>
              <span class="flex-1" />
              <span
                v-if="task.isPomodoroTask"
                class="text-xs tabular-nums text-muted-foreground"
              >
                {{ formatPomodoro(task.pomodoroCompleted || 0) }}/{{ localPomodoroCount }}
              </span>
              <Button
                v-if="task.isPomodoroTask"
                variant="ghost"
                size="icon"
                class="h-7 w-7 shrink-0"
                @click="handleStartTimer"
              >
                <Play :size="14" class="text-red-500" />
              </Button>
              <Switch
                v-if="effectiveEditable"
                :checked="!!task.isPomodoroTask"
                @update:checked="onPomodoroToggle"
              />
            </div>
            <PomodoroSettings
              v-if="task.isPomodoroTask"
              :count="localPomodoroCount"
              :duration="localPomodoroDuration"
              :short-break="localShortBreak"
              :long-break="localLongBreak"
              :long-break-interval="localLongBreakInterval"
              :editable="effectiveEditable"
              @update:count="localPomodoroCount = $event"
              @update:duration="localPomodoroDuration = $event"
              @update:short-break="localShortBreak = $event"
              @update:long-break="localLongBreak = $event"
              @update:long-break-interval="localLongBreakInterval = $event"
              @blur="emitPomodoroUpdate"
            />
          </div>

          <!-- Mobile: property chips -->
          <TaskPropertyChips
            v-if="isMobile"
            :project-title="projectTitle"
            :due-date="localDueDate"
            :deadline="localDeadline"
            :priority="localPriority"
            :location="localLocation"
            :tags="localTags"
            :recurrence="localRecurrence"
            :goals-label="goalsChipLabel"
            :goals-set="localGoalIds.length > 0"
            :editable="effectiveEditable"
            class="-mx-7 border-y border-border/40"
            @select="activeDrawer = ($event as DrawerField)"
          />

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
                class="group flex items-start gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  :model-value="item.completed"
                  :disabled="!effectiveEditable"
                  class="shrink-0 mt-0.5"
                  @update:model-value="effectiveEditable && toggleChecklistItem(item.id)"
                />
                <span
                  v-if="!effectiveEditable"
                  :class="[
                    'text-sm flex-1 min-w-0 break-words whitespace-pre-wrap transition-colors',
                    item.completed && 'line-through text-muted-foreground'
                  ]"
                >
                  {{ item.text }}
                </span>
                <textarea
                  v-else
                  :value="item.text"
                  rows="1"
                  :class="[
                    'text-sm flex-1 min-w-0 break-words whitespace-pre-wrap resize-none bg-transparent border-none outline-none transition-colors leading-5 py-0',
                    item.completed && 'line-through text-muted-foreground'
                  ]"
                  @vue:mounted="autosizeTextarea($event.el as HTMLTextAreaElement)"
                  @input="autosizeTextarea($event.target as HTMLTextAreaElement)"
                  @blur="updateChecklistItemText(item.id, ($event.target as HTMLTextAreaElement).value)"
                  @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
                />
                <button
                  v-if="effectiveEditable"
                  class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground"
                  @click="removeChecklistItem(item.id)"
                >
                  <X :size="14" />
                </button>
              </div>
            </div>

            <!-- Add new item -->
            <div v-if="effectiveEditable" class="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors">
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

        <!-- Desktop: sidebar -->
        <div v-if="!isMobile" class="sm:w-60 shrink-0 border-t sm:border-t-0 sm:border-l border-border/60 overflow-y-auto bg-muted/30">
          <!-- Проект -->
          <ProjectPicker
            :model-value="localProjectId"
            :disabled="!effectiveEditable"
            @update:model-value="onProjectChange"
          />

          <GoalPicker
            :model-value="localGoalIds"
            :disabled="!effectiveEditable"
            @update:model-value="onGoalsChange"
          />

          <!-- Срок (dueDate) -->
          <DropdownMenu>
            <div class="relative border-b border-border/40">
              <DropdownMenuTrigger as-child>
                <button :class="['w-full px-4 py-2.5 transition-colors text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                  <div class="flex items-center gap-2 mb-1">
                    <CalendarIcon :size="13" class="text-muted-foreground/60" />
                    <span class="text-[11px] text-muted-foreground/60 font-medium">Срок</span>
                  </div>
                  <div :class="['text-[13px] truncate', URGENCY_CLASSES[getDueDateUrgency(localDueDate)] || (localDueDate ? '' : 'text-muted-foreground/40')]">
                    {{ localDueDate ? formatDueDate(localDueDate, { includeYear: true }) : 'Не задано' }}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <button
                v-if="effectiveEditable && localDueDate"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Очистить дату"
                @click.stop="localDueDate = undefined; localDueTime = ''"
              >
                <X :size="14" />
              </button>
            </div>
            <DropdownMenuContent class="w-auto p-0">
              <div class="p-3 space-y-3">
                <Calendar
                  :model-value="dueDateCalendarValue"
                  :locale="intlLocale"
                  :week-starts-on="weekStartsOn"
                  weekday-format="short"
                  @update:model-value="onDueDateCalendarChange"
                />
                <Input
                  v-model="localDueTime"
                  type="time"
                  class="w-full"
                  placeholder="Время (необязательно)"
                  @change="onDueTimeChange"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Дедлайн -->
          <DropdownMenu>
            <div class="relative border-b border-border/40">
              <DropdownMenuTrigger as-child>
                <button :class="['w-full px-4 py-2.5 transition-colors text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                  <div class="flex items-center gap-2 mb-1">
                    <Clock :size="13" class="text-muted-foreground/60" />
                    <span class="text-[11px] text-muted-foreground/60 font-medium">Дедлайн</span>
                  </div>
                  <div :class="['text-[13px] truncate', localDeadline ? '' : 'text-muted-foreground/40']">
                    {{ localDeadline ? formatDate(localDeadline, DATE_WITH_TIME) : 'Не задано' }}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <button
                v-if="effectiveEditable && localDeadline"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Очистить дедлайн"
                @click.stop="localDeadline = undefined"
              >
                <X :size="14" />
              </button>
            </div>
            <DeadlinePicker
              :model-value="localDeadline"
              @update:model-value="localDeadline = $event"
            />
          </DropdownMenu>

          <!-- Приоритет -->
          <DropdownMenu>
            <div class="relative border-b border-border/40">
              <DropdownMenuTrigger as-child>
                <button :class="['w-full px-4 py-2.5 transition-colors text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                  <div class="flex items-center gap-2 mb-1">
                    <Flag :size="13" :class="localPriority ? getPriorityColor(localPriority) : 'text-muted-foreground/60'" />
                    <span class="text-[11px] text-muted-foreground/60 font-medium">Приоритет</span>
                  </div>
                  <div :class="['text-[13px] truncate', localPriority ? '' : 'text-muted-foreground/40']">
                    {{ localPriority ? PRIORITY_LABELS[localPriority] : 'Не задано' }}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <button
                v-if="effectiveEditable && localPriority"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Очистить приоритет"
                @click.stop="localPriority = undefined; emitUpdate({ priority: null })"
              >
                <X :size="14" />
              </button>
            </div>
            <PriorityPicker
              :model-value="localPriority"
              @update:model-value="localPriority = $event ?? undefined; emitUpdate({ priority: $event })"
            />
          </DropdownMenu>

          <!-- Место -->
          <DropdownMenu>
            <div class="relative border-b border-border/40">
              <DropdownMenuTrigger as-child>
                <button :class="['w-full px-4 py-2.5 transition-colors text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                  <div class="flex items-center gap-2 mb-1">
                    <MapPin :size="13" class="text-muted-foreground/60" />
                    <span class="text-[11px] text-muted-foreground/60 font-medium">Место</span>
                  </div>
                  <div :class="['text-[13px] truncate', localLocation ? '' : 'text-muted-foreground/40']">
                    {{ localLocation || 'Не задано' }}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <button
                v-if="effectiveEditable && localLocation"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Очистить место"
                @click.stop="localLocation = ''; emitUpdate({ location: undefined })"
              >
                <X :size="14" />
              </button>
            </div>
            <DropdownMenuContent>
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
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
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
            <DropdownMenuContent>
              <TagsEditor
                :model-value="localTags"
                :editable="effectiveEditable"
                @update:model-value="localTags = $event; emitUpdate({ tags: [...$event] })"
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Повторение -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                <div class="flex items-center gap-2 mb-1">
                  <Repeat :size="13" :class="localRecurrence ? 'text-primary' : 'text-muted-foreground/40'" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Повторение</span>
                </div>
                <div :class="['text-[13px]', localRecurrence ? 'text-foreground' : 'text-muted-foreground/40']">
                  {{ formatRecurrence(localRecurrence) }}
                </div>
              </button>
            </DropdownMenuTrigger>
            <RecurrencePicker
              :model-value="localRecurrence"
              :on-missed="localOnMissed"
              @update:model-value="onRecurrenceChange"
              @update:on-missed="onMissedChange"
            />
          </DropdownMenu>

          <!-- Напоминание (mock) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button :class="['w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left', effectiveEditable && 'cursor-pointer hover:bg-muted/50']" :disabled="!effectiveEditable">
                <div class="flex items-center gap-2 mb-1">
                  <Bell :size="13" class="text-muted-foreground/40" />
                  <span class="text-[11px] text-muted-foreground/60 font-medium">Напоминание</span>
                </div>
                <div class="text-[13px] text-muted-foreground/40">Нет</div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div class="p-3 text-xs text-muted-foreground">Скоро</div>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Mobile bottom drawer -->
  <Drawer v-if="isMobile" v-model:open="drawerOpen">
    <DrawerContent class="max-h-[85dvh]">
      <DrawerHeader>
        <DrawerTitle>{{ drawerTitle }}</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 overflow-y-auto">
        <ProjectPickerContent
          v-if="activeDrawer === 'project'"
          :model-value="localProjectId"
          @update:model-value="onProjectChange"
        />
        <GoalPickerContent
          v-if="activeDrawer === 'goals'"
          :model-value="localGoalIds"
          @update:model-value="onGoalsChange"
        />
        <DueDatePickerContent
          v-if="activeDrawer === 'dueDate'"
          :model-value="localDueDate"
          :time="localDueTime"
          @update:model-value="onDueDateDrawerChange"
          @update:time="localDueTime = $event"
        />
        <DeadlinePickerContent
          v-if="activeDrawer === 'deadline'"
          :model-value="localDeadline"
          @update:model-value="localDeadline = $event"
        />
        <PriorityPickerContent
          v-if="activeDrawer === 'priority'"
          :model-value="localPriority"
          @update:model-value="onPriorityDrawerChange"
        />
        <LocationPickerContent
          v-if="activeDrawer === 'location'"
          :model-value="localLocation"
          @update:model-value="onLocationDrawerChange"
        />
        <TagsEditor
          v-if="activeDrawer === 'tags'"
          :model-value="localTags"
          :editable="effectiveEditable"
          @update:model-value="localTags = $event; emitUpdate({ tags: [...$event] })"
        />
        <RecurrencePickerContent
          v-if="activeDrawer === 'recurrence'"
          :model-value="localRecurrence"
          :on-missed="localOnMissed"
          @update:model-value="onRecurrenceDrawerChange"
          @update:on-missed="onMissedChange"
        />
        <div v-if="activeDrawer === 'reminder'" class="py-4 text-sm text-muted-foreground text-center">
          Скоро
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
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
  Play,
} from 'lucide-vue-next'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ContentEditableInput } from '@/components/ui/content-editable-input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { RoundCheckbox } from '@/components/ui/roundCheckbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate, formatDueDate, formatPomodoro, DATE_WITH_TIME } from '../lib/formatters'
import { toDate, toCalendarDateValue, getTimeString, updateDeadlineTime } from '../lib/dateTime'
import type { Priority } from '../model/types'
import { PRIORITY_LABELS, POMODORO_DEFAULTS } from '../model/constants'
import { getPriorityColor } from '../lib/priority'
import { type DueDateUrgency, getDueDateUrgency } from '../lib/urgency'
import { createChecklistItem, computeChecklistProgress } from '../lib/checklist'
import { countFromDurationMinutes } from '../lib/duration'
import { toTimerTask, useTimerStore } from '@/features/task-timer'

const URGENCY_CLASSES: Record<DueDateUrgency, string> = {
  overdue: 'text-red-500',
  soon: 'text-yellow-600 dark:text-yellow-500',
  normal: '',
  none: '',
}
import type { Task, ChecklistItem, TaskPatch } from '../model/types'
import type { RecurrenceRule } from '../model/recurrence'
import { formatRecurrence } from '../model/recurrence'
import TagsEditor from './TagsEditor.vue'
import RecurrencePicker from './RecurrencePicker.vue'
import PriorityPicker from './PriorityPicker.vue'
import DeadlinePicker from './DeadlinePicker.vue'
import PomodoroSettings from './PomodoroSettings.vue'
import TaskPropertyChips from './TaskPropertyChips.vue'
import PriorityPickerContent from './PriorityPickerContent.vue'
import RecurrencePickerContent from './RecurrencePickerContent.vue'
import DeadlinePickerContent from './DeadlinePickerContent.vue'
import DueDatePickerContent from './DueDatePickerContent.vue'
import LocationPickerContent from './LocationPickerContent.vue'
import ProjectPicker from '@/features/projects/ui/ProjectPicker.vue'
import ProjectPickerContent from '@/features/projects/ui/ProjectPickerContent.vue'
import GoalPicker from '@/features/goals/ui/GoalPicker.vue'
import GoalPickerContent from '@/features/goals/ui/GoalPickerContent.vue'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useTaskStore } from '../model/task-store'

// Mobile detection
const isDesktop = useMediaQuery('(min-width: 640px)')
const isMobile = computed(() => !isDesktop.value)

// Drawer state
type DrawerField = 'project' | 'goals' | 'dueDate' | 'deadline' | 'priority' | 'location' | 'tags' | 'recurrence' | 'reminder'
const activeDrawer = ref<DrawerField | null>(null)
const drawerOpen = computed({
  get: () => activeDrawer.value !== null,
  set: (v) => { if (!v) activeDrawer.value = null },
})

const DRAWER_TITLES: Record<DrawerField, string> = {
  project: 'Проект',
  goals: 'Цель',
  dueDate: 'Срок',
  deadline: 'Дедлайн',
  priority: 'Приоритет',
  location: 'Место',
  tags: 'Теги',
  recurrence: 'Повторение',
  reminder: 'Напоминание',
}
const drawerTitle = computed(() => activeDrawer.value ? DRAWER_TITLES[activeDrawer.value] : '')

const props = withDefaults(defineProps<{
  task: Task | null
  open: boolean
  editable?: boolean
  autofocusTitle?: boolean
}>(), {
  editable: true,
  autofocusTitle: false,
})

const effectiveEditable = computed(() => props.editable && !props.task?.isOverdue)

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
  } | null): void
}>()

// Contenteditable refs
const titleRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const descriptionRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const localTitle = ref('')
const localDescription = ref('')

// Description expand/collapse
const DESCRIPTION_MAX_LINES = 10
const descriptionExpanded = ref(false)
const descriptionFocused = ref(false)
const descriptionOverflows = ref(false)

function checkDescriptionOverflow() {
  const el = descriptionRef.value?.el
  if (!el) {
    descriptionOverflows.value = false
    return
  }
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    descriptionOverflows.value = false
    return
  }
  const threshold = lineHeight * DESCRIPTION_MAX_LINES + 8
  descriptionOverflows.value = el.scrollHeight > threshold + 1
}

// Checklist state
const localChecklist = ref<ChecklistItem[]>([])
const newChecklistItem = ref('')

// Sidebar field refs
const localDueTime = ref('')
const localDueDate = ref<Date | undefined>()
const localDeadline = ref<Date | undefined>()
const localPriority = ref<Priority | undefined>()
const localLocation = ref('')
const localTags = ref<string[]>([])

// Recurrence
const localRecurrence = ref<RecurrenceRule | null>(null)
const localOnMissed = ref<'shift' | 'freeze'>('shift')

// Timer
const timerStore = useTimerStore()

function handleStartTimer() {
  if (!props.task?.isPomodoroTask) return
  timerStore.startTask(toTimerTask(props.task))
}

// Project
const localProjectId = ref<string | null>(null)
const projectStore = useProjectStore()

const projectTitle = computed(() =>
  localProjectId.value
    ? projectStore.projectMap.get(localProjectId.value)?.title ?? null
    : null,
)

function onProjectChange(value: string | null) {
  localProjectId.value = value
  emitUpdate({ projectId: value })
  activeDrawer.value = null
}

const localGoalIds = ref<number[]>([])
const taskStore = useTaskStore()

const goalsChipLabel = computed(() => {
  const n = localGoalIds.value.length
  if (n === 0) return 'Цель'
  if (n === 1) return 'Цель'
  return `${n} цели`
})

async function onGoalsChange(value: number[]) {
  const previous = localGoalIds.value
  localGoalIds.value = value
  if (!props.task) return
  try {
    const saved = await taskStore.setTaskGoals(props.task.id, value)
    if (saved) localGoalIds.value = saved
  }
  catch (err) {
    localGoalIds.value = previous
    console.error('Не удалось обновить цели задачи:', err)
  }
}

function onRecurrenceChange(value: RecurrenceRule | null) {
  localRecurrence.value = value
  emitUpdate({ recurrence: value })
}

function onMissedChange(value: 'shift' | 'freeze') {
  localOnMissed.value = value
  emitUpdate({ onMissed: value })
}

// Drawer-specific handlers (auto-close for single-select)
function onPriorityDrawerChange(value: Priority | null) {
  localPriority.value = value ?? undefined
  emitUpdate({ priority: value })
  activeDrawer.value = null
}

function onRecurrenceDrawerChange(value: RecurrenceRule | null) {
  localRecurrence.value = value
  emitUpdate({ recurrence: value })
  activeDrawer.value = null
}

function onLocationDrawerChange(value: string | undefined) {
  localLocation.value = value || ''
  emitUpdate({ location: value })
  activeDrawer.value = null
}

function onDueDateDrawerChange(val: Date | undefined) {
  localDueDate.value = val
}

// Pomodoro refs
const localPomodoroCount = ref(POMODORO_DEFAULTS.count)
const localPomodoroDuration = ref(POMODORO_DEFAULTS.duration)
const localShortBreak = ref(POMODORO_DEFAULTS.shortBreak)
const localLongBreak = ref(POMODORO_DEFAULTS.longBreak)
const localLongBreakInterval = ref(POMODORO_DEFAULTS.longBreakInterval)

// Suppresses auto-emit watchers while we're rehydrating local state from props.task.
// Without this, syncing localDueDate/localDeadline below would trigger their watchers
// and emit a redundant PATCH on every dialog open.
const isInitializing = ref(false)

// Sync local state when task changes
watch(() => props.task, (task) => {
  if (task) {
    isInitializing.value = true
    localTitle.value = task.title
    localDescription.value = task.description || ''
    localChecklist.value = task.checklist?.items
      ? task.checklist.items.map(item => ({ ...item }))
      : []
    localDueDate.value = task.dueDate
    localDueTime.value = task.dueDate ? getTimeString(task.dueDate) : ''
    localDeadline.value = task.deadline
    localPriority.value = task.priority
    localLocation.value = task.location || ''
    localTags.value = task.tags ? [...task.tags] : []
    localProjectId.value = task.projectId ?? null
    localGoalIds.value = task.goalIds ? [...task.goalIds] : []
    localRecurrence.value = task.recurrence ?? null
    localOnMissed.value = task.onMissed ?? 'shift'
    localPomodoroCount.value = task.pomodoroCount ?? POMODORO_DEFAULTS.count
    localPomodoroDuration.value = task.pomodoroDuration ?? POMODORO_DEFAULTS.duration
    localShortBreak.value = task.shortBreak ?? POMODORO_DEFAULTS.shortBreak
    localLongBreak.value = task.longBreak ?? POMODORO_DEFAULTS.longBreak
    localLongBreakInterval.value = task.longBreakInterval ?? POMODORO_DEFAULTS.longBreakInterval
    descriptionExpanded.value = false
    nextTick(() => {
      checkDescriptionOverflow()
      isInitializing.value = false
    })
  }
}, { immediate: true })

watch(localDescription, () => nextTick(checkDescriptionOverflow))
watch(() => props.open, (open) => {
  if (open) {
    nextTick(checkDescriptionOverflow)
    if (props.autofocusTitle) {
      nextTick(() => titleRef.value?.el?.focus())
    }
  }
})

const dueDateCalendarValue = computed(() => toCalendarDateValue(localDueDate.value))

function onDueDateCalendarChange(val: any) {
  const date = toDate(val)
  if (date && localDueTime.value) {
    localDueDate.value = updateDeadlineTime(date, localDueTime.value)
  } else {
    localDueDate.value = date
  }
}

function onDueTimeChange() {
  if (localDueDate.value && localDueTime.value) {
    localDueDate.value = updateDeadlineTime(localDueDate.value, localDueTime.value)
  }
}

// Watch sidebar fields for auto-emit
watch(localDueDate, (val) => {
  if (isInitializing.value) return
  emitUpdate({ dueDate: val })
})

watch(localDeadline, (val) => {
  if (isInitializing.value) return
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

function onPomodoroToggle(enabled: boolean) {
  if (!props.task) return
  if (!enabled) {
    emit('update:pomodoroConfig', props.task.id, null)
    return
  }
  localPomodoroCount.value = props.task.durationMinutes
    ? countFromDurationMinutes(props.task.durationMinutes)
    : POMODORO_DEFAULTS.count
  localPomodoroDuration.value = POMODORO_DEFAULTS.duration
  localShortBreak.value = POMODORO_DEFAULTS.shortBreak
  localLongBreak.value = POMODORO_DEFAULTS.longBreak
  localLongBreakInterval.value = POMODORO_DEFAULTS.longBreakInterval
  emitPomodoroUpdate()
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

function onDescriptionBlur() {
  descriptionFocused.value = false
  commitDescription()
  nextTick(checkDescriptionOverflow)
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

function autosizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function emitUpdate(partial: TaskPatch) {
  if (!props.task) return
  emit('update', { ...props.task, ...partial } as Task)
}
</script>

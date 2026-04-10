<template>
  <div class="flex gap-2 overflow-x-auto px-5 py-2.5 scrollbar-hide overscroll-x-contain">
    <button
      v-for="chip in chips"
      :key="chip.key"
      :class="[
        'shrink-0 inline-flex items-center gap-1.5 h-9 min-h-[44px] px-3 rounded-full border text-xs whitespace-nowrap touch-manipulation transition-colors',
        chip.isSet
          ? 'bg-secondary text-secondary-foreground border-secondary'
          : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50',
      ]"
      @click="editable && $emit('select', chip.key)"
    >
      <component :is="chip.icon" :size="13" :class="chip.iconClass" />
      {{ chip.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  MapPin,
  Tag,
  FolderOpen,
  Repeat,
  Bell,
} from 'lucide-vue-next'
import { formatDueDate, formatDate, DATE_WITH_TIME } from '../lib/formatters'
import { PRIORITY_LABELS } from '../model/constants'
import { getPriorityColor } from '../lib/priority'
import type { Priority } from '../model/types'
import type { RecurrenceRule } from '../model/recurrence'
import { formatRecurrence } from '../model/recurrence'

const props = defineProps<{
  projectTitle: string | null
  dueDate: Date | undefined
  deadline: Date | undefined
  priority: Priority | undefined
  location: string
  tags: string[]
  recurrence: RecurrenceRule | null
  editable: boolean
}>()

defineEmits<{
  (e: 'select', key: string): void
}>()

interface ChipDef {
  key: string
  icon: Component
  label: string
  isSet: boolean
  iconClass?: string
}

const chips = computed<ChipDef[]>(() => [
  {
    key: 'project',
    icon: FolderOpen,
    label: props.projectTitle || 'Входящие',
    isSet: !!props.projectTitle,
  },
  {
    key: 'dueDate',
    icon: CalendarIcon,
    label: props.dueDate ? formatDueDate(props.dueDate) : 'Срок',
    isSet: !!props.dueDate,
  },
  {
    key: 'deadline',
    icon: Clock,
    label: props.deadline ? formatDate(props.deadline, DATE_WITH_TIME) : 'Дедлайн',
    isSet: !!props.deadline,
  },
  {
    key: 'priority',
    icon: Flag,
    label: props.priority ? PRIORITY_LABELS[props.priority] : 'Приоритет',
    isSet: !!props.priority,
    iconClass: props.priority ? getPriorityColor(props.priority) : undefined,
  },
  {
    key: 'location',
    icon: MapPin,
    label: props.location || 'Место',
    isSet: !!props.location,
  },
  {
    key: 'tags',
    icon: Tag,
    label: props.tags.length > 0
      ? (props.tags.length === 1 ? props.tags[0] : `${props.tags.length} тегов`)
      : 'Теги',
    isSet: props.tags.length > 0,
  },
  {
    key: 'recurrence',
    icon: Repeat,
    label: props.recurrence ? formatRecurrence(props.recurrence) : 'Повтор',
    isSet: !!props.recurrence,
  },
  {
    key: 'reminder',
    icon: Bell,
    label: 'Напомнить',
    isSet: false,
  },
])
</script>

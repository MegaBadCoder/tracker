<template>
  <div class="flex flex-wrap gap-2">
    <Badge v-if="dueDate" variant="outline" class="gap-1">
      <Calendar :size="12" />
      {{ formatDate(dueDate, DATE_SHORT) }}
    </Badge>

    <Badge v-if="deadline" variant="outline" class="gap-1">
      <Clock :size="12" />
      {{ formatDate(deadline, DATE_WITH_TIME) }}
    </Badge>

    <Badge v-if="priority" variant="outline" class="gap-1">
      <Flag :size="12" />
      {{ priority }}
    </Badge>

    <Badge v-if="location" variant="outline" class="gap-1">
      <MapPin :size="12" />
      {{ location }}
    </Badge>

    <Badge
      v-for="tag in tags"
      :key="tag"
      variant="secondary"
      class="gap-1"
    >
      <Tag :size="12" />
      {{ tag }}
    </Badge>

    <Badge v-if="isRecurring" variant="outline" class="gap-1 text-blue-600 border-blue-300/50 dark:text-blue-400 dark:border-blue-500/30">
      <Repeat :size="12" />
      {{ recurrenceLabel }}
    </Badge>

    <Badge
      v-if="isPomodoroTask"
      variant="outline"
      class="gap-1 bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-300 dark:border-red-500/30 dark:bg-red-500/20 cursor-pointer hover:bg-red-500/20 dark:hover:bg-red-500/30"
      @click="$emit('showTimer')"
    >
      <Timer :size="12" />
      {{ formatPomodoro(pomodoroCompleted || 0) }}/{{ pomodoroCount || 0 }}
    </Badge>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  MapPin,
  Flag,
  Tag,
  Timer,
  Repeat,
} from 'lucide-vue-next'
import { formatDate, formatPomodoro, DATE_SHORT, DATE_WITH_TIME } from '../lib/formatters'
import { formatRecurrence } from '../model/recurrence'
import type { RecurrenceRule } from '../model/recurrence'
import type { Priority } from '../model/types'

interface Props {
  dueDate?: Date
  deadline?: Date
  priority?: Priority
  location?: string
  tags?: string[]
  recurrence?: RecurrenceRule | null
  isPomodoroTask?: boolean
  pomodoroCompleted?: number
  pomodoroCount?: number
}

interface Emits {
  (e: 'showTimer'): void
}

import { computed } from 'vue'

const props = defineProps<Props>()
defineEmits<Emits>()

const isRecurring = computed(() => !!props.recurrence)
const recurrenceLabel = computed(() => formatRecurrence(props.recurrence))
</script>

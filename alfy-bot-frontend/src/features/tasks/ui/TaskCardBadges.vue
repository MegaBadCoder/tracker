<template>
  <div class="flex flex-wrap gap-2">
    <Badge v-if="dueDate" variant="outline" class="gap-1">
      <Calendar :size="12" />
      {{ formatDate(dueDate, 'MMM d') }}
    </Badge>

    <Badge v-if="deadline" variant="outline" class="gap-1">
      <Clock :size="12" />
      {{ formatDate(deadline, 'MMM d, HH:mm') }}
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
  Timer
} from 'lucide-vue-next'
import { formatDate, formatPomodoro } from '../lib/formatters'
import type { Priority } from '../model/constants'

interface Props {
  dueDate?: Date
  deadline?: Date
  priority?: Priority
  location?: string
  tags?: string[]
  isPomodoroTask?: boolean
  pomodoroCompleted?: number
  pomodoroCount?: number
}

interface Emits {
  (e: 'showTimer'): void
}

defineProps<Props>()
defineEmits<Emits>()

</script>

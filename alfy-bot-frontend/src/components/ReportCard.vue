<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { ref } from 'vue'
import { formatDate } from '../utils/date'
import { getReportAnswerValue } from '../utils/reportAnswer'
import type { Question, Report, ReportStatus } from '../types'

const props = defineProps<{
  report: Report
  questions: Question[]
}>()

const open = ref(false)

const statusConfig: Record<ReportStatus, { label: string, classes: string }> = {
  completed: { label: 'Выполнен', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  skipped: { label: 'Пропущен', classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  in_progress: { label: 'В процессе', classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  expired: { label: 'Истёк', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  cancelled: { label: 'Отменён', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function getQuestion(id: number): Question | undefined {
  return props.questions.find(q => q.id === id)
}

function formatValue(value: number | string | boolean | null): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return String(value)
}
</script>

<template>
  <div class="border border-border rounded-xl overflow-hidden">
    <!-- header -->
    <button
      class="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent transition-colors text-left"
      @click="open = !open"
    >
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-card-foreground">
          {{ formatDate(report.date) }}
        </span>
        <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusConfig[report.status].classes]">
          {{ statusConfig[report.status].label }}
        </span>
      </div>
      <ChevronDown
        :class="['w-4 h-4 text-muted-foreground transition-transform duration-200', open ? 'rotate-180' : '']"
      />
    </button>

    <!-- body -->
    <div v-if="open && report.answers.length" class="px-4 py-3 bg-muted border-t border-border space-y-2">
      <div
        v-for="answer in report.answers"
        :key="answer.questionId"
        class="flex items-start justify-between gap-4"
      >
        <span class="text-sm text-muted-foreground flex-1">
          {{ getQuestion(answer.questionId)?.question }}
        </span>
        <span class="text-sm font-medium text-foreground text-right flex-shrink-0">
          {{ formatValue(getReportAnswerValue(answer)) }}
        </span>
      </div>
    </div>

    <div v-else-if="open && !report.answers.length" class="px-4 py-3 bg-muted border-t border-border">
      <span class="text-sm text-muted-foreground italic">Отчёт не заполнен</span>
    </div>
  </div>
</template>

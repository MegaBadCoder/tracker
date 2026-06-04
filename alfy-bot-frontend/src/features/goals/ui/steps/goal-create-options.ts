/**
 * Единый источник ярлыков и пресетов для мастера создания цели (`goals/new`).
 *
 * Сейчас значения ЗАХАРДКОЖЕНЫ как зеркало Telegram-бота
 * (`alfy-bot/src/shared/constants/date-options.ts`, `messages.ts`,
 * `create-goal.scene.ts`) — чтобы веб и бот показывали одно и то же.
 *
 * БУДУЩЕЕ: эти значения должны приходить с бэка как единый источник истины
 * (один endpoint отдаёт лейблы/пресеты для бота и веба). Тогда заменяется
 * только наполнение этого модуля — потребители (step-компоненты, composable)
 * не меняются.
 */

import type { EndPresetKey, StartPresetKey } from '@/features/goals/model/use-goal-create-flow'

/** Пресеты даты НАЧАЛА. Зеркало `generateStartDateButtons` (бот). */
export interface StartPresetOption {
  key: Exclude<StartPresetKey, 'custom'>
  label: string
}

export const START_PRESETS: StartPresetOption[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'tomorrow', label: 'Завтра' },
  { key: 'week', label: 'Через неделю' },
]

/**
 * Пресеты даты ОКОНЧАНИЯ. Зеркало `DATE_DURATIONS` (бот):
 * 12 недель / 24 недели / 6 мес / 1 год.
 */
export interface EndPresetOption {
  key: Exclude<EndPresetKey, 'custom'>
  label: string
}

export const END_PRESETS: EndPresetOption[] = [
  { key: 'weeks_12', label: '12 недель' },
  { key: 'weeks_24', label: '24 недели' },
  { key: 'months_6', label: '6 мес' },
  { key: 'year_1', label: '1 год' },
]

/**
 * Пресеты интервала «раз в N дней». Зеркало кнопок `showIntervalStep` (бот):
 * значение + точная подпись.
 */
export interface IntervalPresetOption {
  days: number
  label: string
}

export const INTERVAL_PRESETS: IntervalPresetOption[] = [
  { days: 2, label: 'Каждые 2 дня' },
  { days: 3, label: 'Каждые 3 дня' },
  { days: 7, label: 'Раз в неделю' },
  { days: 14, label: 'Раз в 2 недели' },
]

/** Подписи частоты отчётов. Зеркало `MESSAGES.SCHEDULE` (бот). */
export const SCHEDULE_LABELS = {
  daily: 'Каждый день',
  weekly_days: 'Определённые дни недели',
  interval: 'Через N дней',
} as const

/** Дни недели, Пн-первым (Вс = 0 в конце). Зеркало `DAYS_OF_WEEK` (бот). */
export const WEEKDAYS: { idx: number, label: string }[] = [
  { idx: 1, label: 'Пн' },
  { idx: 2, label: 'Вт' },
  { idx: 3, label: 'Ср' },
  { idx: 4, label: 'Чт' },
  { idx: 5, label: 'Пт' },
  { idx: 6, label: 'Сб' },
  { idx: 0, label: 'Вс' },
]

export const WEEKDAY_LABELS: Record<number, string> = Object.fromEntries(
  WEEKDAYS.map(d => [d.idx, d.label]),
)

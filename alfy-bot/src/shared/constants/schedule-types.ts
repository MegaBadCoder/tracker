export const FREQUENCY_TYPES = {
  DAILY: 'daily',
  WEEKLY_DAYS: 'weekly_days',
  INTERVAL: 'interval',
} as const;

export type FrequencyType =
  (typeof FREQUENCY_TYPES)[keyof typeof FREQUENCY_TYPES];

export const DAYS_OF_WEEK = [
  { day: 1, label: 'Пн' },
  { day: 2, label: 'Вт' },
  { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' },
  { day: 5, label: 'Пт' },
  { day: 6, label: 'Сб' },
  { day: 0, label: 'Вс' },
];

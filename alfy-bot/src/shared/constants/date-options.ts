export const START_DATE_OPTIONS = {
  TODAY: 'start_today',
  TOMORROW: 'start_tomorrow',
  WEEK: 'start_week',
  CUSTOM: 'start_custom',
} as const;

export const END_DATE_OPTIONS = {
  WEEKS_12: 'end_12weeks',
  WEEKS_24: 'end_24weeks',
  MONTHS_6: 'end_6months',
  YEAR_1: 'end_1year',
  CUSTOM: 'end_custom',
} as const;

export const DATE_DURATIONS = {
  [END_DATE_OPTIONS.WEEKS_12]: { weeks: 12, label: '12 недель' },
  [END_DATE_OPTIONS.WEEKS_24]: { weeks: 24, label: '24 недели' },
  [END_DATE_OPTIONS.MONTHS_6]: { months: 6, label: '6 мес' },
  [END_DATE_OPTIONS.YEAR_1]: { years: 1, label: '1 год' },
} as const;

import { addWeeks, addMonths, addYears, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  START_DATE_OPTIONS,
  END_DATE_OPTIONS,
  DATE_DURATIONS,
} from '../constants/date-options';
import { DATE_FORMATS } from '../constants/date-formats';

export function generateStartDateButtons() {
  return [
    [
      { text: 'Сегодня', callback_data: START_DATE_OPTIONS.TODAY },
      { text: 'Завтра', callback_data: START_DATE_OPTIONS.TOMORROW },
    ],
    [{ text: 'Через неделю', callback_data: START_DATE_OPTIONS.WEEK }],
    [{ text: '✏️ Своя дата', callback_data: START_DATE_OPTIONS.CUSTOM }],
  ];
}

export function generateEndDateButtons() {
  return [
    [
      {
        text: DATE_DURATIONS[END_DATE_OPTIONS.WEEKS_12].label,
        callback_data: END_DATE_OPTIONS.WEEKS_12,
      },
      {
        text: DATE_DURATIONS[END_DATE_OPTIONS.WEEKS_24].label,
        callback_data: END_DATE_OPTIONS.WEEKS_24,
      },
    ],
    [
      {
        text: DATE_DURATIONS[END_DATE_OPTIONS.MONTHS_6].label,
        callback_data: END_DATE_OPTIONS.MONTHS_6,
      },
      {
        text: DATE_DURATIONS[END_DATE_OPTIONS.YEAR_1].label,
        callback_data: END_DATE_OPTIONS.YEAR_1,
      },
    ],
    [{ text: '✏️ Своя дата', callback_data: END_DATE_OPTIONS.CUSTOM }],
  ];
}

export function calculateEndDate(startDate: Date, option: string): Date {
  const duration = DATE_DURATIONS[option as keyof typeof DATE_DURATIONS];

  if (!duration) {
    throw new Error(`Unknown option: ${option}`);
  }

  if ('weeks' in duration) {
    return addWeeks(startDate, duration.weeks);
  } else if ('months' in duration) {
    return addMonths(startDate, duration.months);
  } else if ('years' in duration) {
    return addYears(startDate, duration.years);
  }

  throw new Error(`Invalid duration config for: ${option}`);
}

export function formatDate(date: Date): string {
  return format(date, DATE_FORMATS.DISPLAY, { locale: ru });
}

export function toISODate(date: Date): string {
  return format(date, DATE_FORMATS.ISO);
}

import { DAYS_OF_WEEK } from '../constants/schedule-types';
import { Schedule } from '../entities';

export function formatSchedule(schedule: Schedule): string {
  switch (schedule.frequency_type) {
    case 'daily':
      return 'Каждый день';
    case 'weekly_days': {
      const days = schedule.days_of_week ?? [];
      return days
        .map((d) => DAYS_OF_WEEK.find((dw) => dw.day === d)?.label ?? '?')
        .join(', ');
    }
    case 'interval':
      return `Каждые ${schedule.interval_days} дн.`;
    default:
      return 'Неизвестно';
  }
}

export function generateDayPickerKeyboard(selectedDays: number[]) {
  const dayButtons = DAYS_OF_WEEK.map(({ day, label }) => ({
    text: selectedDays.includes(day) ? `${label} ✓` : label,
    callback_data: `toggle_day_${day}`,
  }));

  return [
    dayButtons.slice(0, 4),
    dayButtons.slice(4),
    [
      { text: '✅ Готово', callback_data: 'days_done' },
      { text: '⬅️ Назад', callback_data: 'schedule_back' },
    ],
  ];
}

/**
 * Сериализация даты в строку `YYYY-MM-DD` в локальной таймзоне пользователя
 * (wall-clock). Используется для отправки `goal_start`/`goal_end` на бэк,
 * чтобы значение совпадало с тем, что вводит юзер у себя в браузере, без
 * UTC-сдвига.
 *
 * Зеркало бэкендового `goal.service.ts:todayISO`.
 */
export function toLocalISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

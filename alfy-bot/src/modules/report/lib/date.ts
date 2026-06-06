/** Форматирует Date в 'YYYY-MM-DD' по локальному времени (без UTC-сдвига) */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

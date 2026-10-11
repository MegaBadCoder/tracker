/**
 * Выбирает форму русского существительного по числу `n`.
 *
 * `forms` — `[одна, немного, много]`, например `['история', 'истории', 'историй']`.
 * Стандартные правила: 11–14 всегда «много»; иначе по последней цифре
 * (1 → «одна», 2–4 → «немного», остальное — «много»).
 */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const absN = Math.abs(n)
  const lastTwo = absN % 100
  const lastOne = absN % 10

  if (lastTwo >= 11 && lastTwo <= 14)
    return forms[2]

  if (lastOne === 1)
    return forms[0]

  if (lastOne >= 2 && lastOne <= 4)
    return forms[1]

  return forms[2]
}

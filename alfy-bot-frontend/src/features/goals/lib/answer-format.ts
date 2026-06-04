/**
 * Маппинг UI-выбора в строку-ответ, идентичную той, что шлёт Telegram-бот.
 *
 * Источник истины по формату — `alfy-bot/src/shared/utils/question-ui.util.ts`
 * (callback_data `answer_<value>`) + `report.scene.ts`. Веб ОБЯЗАН слать ровно
 * эти строки, иначе история разойдётся с ботом и сломается `normalizeAnswer`.
 *
 * Чистые функции без побочных эффектов; ошибки не глотают.
 */

/** Числовая оценка (`rating`) → `"1".."5"`. */
export function ratingAnswer(n: number): string {
  return String(n)
}

/** Эмодзи-оценка (`emoji_rating`) → 1-based ИНДЕКС строкой (`"1".."5"`), НЕ эмодзи-символ. */
export function emojiRatingAnswer(index1based: number): string {
  return String(index1based)
}

/** Да/Нет (`yes_no`) → `"yes"` / `"no"` (НЕ "Да"/"Нет"). */
export function yesNoAnswer(yes: boolean): string {
  return yes ? 'yes' : 'no'
}

/** Затраченное время (`time_spent`) → лейбл диапазона как есть. */
export function timeSpentAnswer(label: string): string {
  return label
}

/** Число (`number`) → введённое значение строкой, обрезанное по краям. */
export function numberAnswer(raw: string): string {
  return raw.trim()
}

/** Текст (`text`) → введённый текст, обрезанный по краям. */
export function textAnswer(raw: string): string {
  return raw.trim()
}

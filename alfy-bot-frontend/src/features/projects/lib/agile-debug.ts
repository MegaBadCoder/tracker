/**
 * Временная диагностика перетаскивания на Agile-доске.
 * Пишет только в dev. Удалить вместе с вызовами, когда причина найдена.
 */
export function alog(stage: string, payload?: unknown): void {
  if (!import.meta.env.DEV)
    return
  if (payload === undefined)
    console.log(`[agile-dnd] ${stage}`)
  else
    console.log(`[agile-dnd] ${stage}`, payload)
}

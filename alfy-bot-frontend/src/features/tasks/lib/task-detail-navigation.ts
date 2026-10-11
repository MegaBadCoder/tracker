import type { Task } from '../model/types'

type TaskOpener = (task: Task) => void

let opener: TaskOpener | null = null

/**
 * Регистрирует обработчик открытия карточки задачи. Возвращает функцию
 * отмены регистрации, которая снимает только эту регистрацию — если после
 * неё зарегистрировался кто-то другой, повторный вызов unregister её не
 * тронет.
 */
export function registerTaskOpener(fn: TaskOpener): () => void {
  opener = fn
  return () => {
    if (opener === fn)
      opener = null
  }
}

/**
 * Открывает карточку задачи через зарегистрированный обработчик. Без
 * обработчика — ошибка в консоль, тихого no-op нет.
 */
export function openTaskDetail(task: Task): void {
  if (!opener) {
    console.error('openTaskDetail: обработчик открытия карточки задачи не зарегистрирован')
    return
  }
  opener(task)
}

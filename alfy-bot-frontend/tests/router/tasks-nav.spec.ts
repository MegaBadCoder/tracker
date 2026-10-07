import { describe, expect, it } from 'vitest'
import { tasksNavLinks } from '@/router/tasks-nav'

// Модуль импортируется без активной Pinia — ровно так, как это происходит в
// приложении: ссылки собираются раньше, чем поднимается стор. Счётчик поэтому
// тунк: разверни его на уровне модуля, и импорт упадёт.
describe('tasksNavLinks', () => {
  it('собирается без активной Pinia', () => {
    expect(tasksNavLinks.map(link => link.to)).toEqual([
      '/tasks',
      '/tasks/today',
      '/tasks/calendar',
    ])
  })

  it('счётчик есть только у «Сегодня» и остаётся невычисленным до вызова', () => {
    const today = tasksNavLinks.find(link => link.to === '/tasks/today')
    const inbox = tasksNavLinks.find(link => link.to === '/tasks')

    expect(typeof today!.count).toBe('function')
    expect(inbox!.count).toBeUndefined()
  })
})

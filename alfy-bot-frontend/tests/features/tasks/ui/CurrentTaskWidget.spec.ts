import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CurrentTaskWidget from '@/features/tasks/ui/CurrentTaskWidget.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useTimerStore } from '@/features/task-timer'

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

// Часы фиксированы: окно помидоро-задачи считается из её настроек
// (2x25 + 5 = 55 минут), а не из durationMinutes, и «сейчас» не должно
// уползать на границу all-day.
const NOW = new Date('2026-08-13T12:00:00')
const MINUTE = 60 * 1000

function activeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Математика',
    completed: false,
    dueDate: new Date(NOW.getTime() - 10 * MINUTE),
    isPomodoroTask: true,
    pomodoroCount: 2,
    pomodoroDuration: 25,
    ...overrides,
  } as Task
}

function mountWith(tasks: Task[]) {
  useTaskStore().tasks = tasks
  return mount(CurrentTaskWidget)
}

describe('currentTaskWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('не рендерит ничего, когда активных задач нет', () => {
    const wrapper = mountWith([activeTask({ dueDate: new Date(NOW.getTime() + 300 * MINUTE) })])

    expect(wrapper.text()).not.toContain('Текущая задача')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('показывает название активной помидоро-задачи и кнопку запуска', () => {
    const wrapper = mountWith([activeTask()])

    expect(wrapper.text()).toContain('Текущая задача')
    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('не показывает кнопку у не-помидоро задачи', () => {
    const wrapper = mountWith([activeTask({ isPomodoroTask: false, durationMinutes: 60 })])

    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('клик по кнопке запускает таймер по этой задаче', async () => {
    const wrapper = mountWith([activeTask()])
    const spy = vi.spyOn(useTimerStore(), 'startTask').mockImplementation(() => {})

    await wrapper.find('button').trigger('click')

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }))
  })

  it('показывает все активные задачи, когда их несколько', () => {
    const wrapper = mountWith([
      activeTask(),
      activeTask({ id: 'task-2', title: 'Рабочая сессия' }),
    ])

    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.text()).toContain('Рабочая сессия')
  })
})

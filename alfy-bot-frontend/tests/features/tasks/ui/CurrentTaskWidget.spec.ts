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

    expect(wrapper.text()).toContain('Идёт сейчас')
    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('показывает остаток времени и счётчик помидоров', () => {
    // Окно 2x25+5 = 55 мин, прошло 10 → осталось 45.
    const wrapper = mountWith([activeTask({ pomodoroCompleted: 1 })])

    expect(wrapper.text()).toContain('осталось 45 мин')
    expect(wrapper.text()).toContain('1/2')
  })

  it('у не-помидоро задачи остаток есть, счётчика помидоров нет', () => {
    const wrapper = mountWith([activeTask({ isPomodoroTask: false, durationMinutes: 60 })])

    expect(wrapper.text()).toContain('осталось 50 мин')
    expect(wrapper.text()).not.toContain('/')
  })

  it('прогресс-бар отражает долю пройденного окна', () => {
    // 10 из 55 минут ≈ 18%
    const wrapper = mountWith([activeTask()])
    const fill = wrapper.find('[aria-hidden="true"] > div')

    expect(fill.attributes('style')).toContain('width: 18%')
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

  // Суть виджета: он обязан сам перестать показывать задачу, когда её окно
  // истекло, без перезагрузки страницы.
  it('убирает задачу, когда её окно истекает по тику часов', async () => {
    const wrapper = mountWith([activeTask({ isPomodoroTask: false, durationMinutes: 60 })])
    expect(wrapper.text()).toContain('Математика')

    vi.setSystemTime(new Date(NOW.getTime() + 60 * MINUTE))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(wrapper.text()).not.toContain('Математика')
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

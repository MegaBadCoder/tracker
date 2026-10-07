import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TodayView from '@/views/TodayView.vue'

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

/** Вторник, 25 августа 2026, 14:00 по местному времени. */
const NOW = new Date('2026-08-25T14:00:00')

function makeTask(id: string, dueDate: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Задача ${id}`,
    completed: false,
    isOverdue: false,
    dueDate: new Date(dueDate),
    ...overrides,
  } as Task
}

function mountWith(tasks: Task[]) {
  const store = useTaskStore()
  // fetchTasks на монтировании иначе затрёт заготовленный список ответом api.
  const fetchTasks = vi.spyOn(store, 'fetchTasks').mockResolvedValue(undefined)
  const updateTask = vi.spyOn(store, 'updateTask').mockResolvedValue(undefined)
  store.tasks = tasks

  const wrapper = mount(TodayView, {
    global: {
      provide: { openSidebar: () => {} },
      stubs: {
        AppHeader: true,
        TaskCard: { props: ['task'], template: '<div class="task-card">{{ task.title }}</div>' },
        TaskDetailDialog: true,
        TaskForm: true,
      },
    },
  })

  return { wrapper, fetchTasks, updateTask }
}

describe('todayView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('грузит задачи при монтировании', () => {
    const { fetchTasks } = mountWith([])
    expect(fetchTasks).toHaveBeenCalledTimes(1)
  })

  it('рендерит обе группы и раскладывает задачи по ним', () => {
    const { wrapper } = mountWith([
      makeTask('overdue-1', '2026-08-24T19:30:00'),
      makeTask('today-1', '2026-08-25T09:00:00'),
    ])

    expect(wrapper.text()).toContain('Просрочено')
    expect(wrapper.text()).toContain('Сегодня')
    expect(wrapper.findAll('.task-card')).toHaveLength(2)
  })

  it('не рендерит группу «Просрочено», когда она пуста', () => {
    const { wrapper } = mountWith([makeTask('today-1', '2026-08-25T09:00:00')])

    expect(wrapper.text()).not.toContain('Просрочено')
    expect(wrapper.find('[data-testid="reschedule-overdue"]').exists()).toBe(false)
  })

  it('показывает пустое состояние, когда на сегодня ничего нет', () => {
    const { wrapper } = mountWith([makeTask('tomorrow', '2026-08-26T09:00:00')])

    expect(wrapper.text()).toContain('На сегодня задач нет')
    expect(wrapper.findAll('.task-card')).toHaveLength(0)
  })

  it('замороженные и выполненные задачи на экран не попадают', () => {
    const { wrapper } = mountWith([
      makeTask('frozen', '2026-08-24T10:00:00', { isOverdue: true }),
      makeTask('done', '2026-08-25T10:00:00', { completed: true }),
    ])

    expect(wrapper.text()).toContain('На сегодня задач нет')
  })

  it('«Перенести» двигает каждую просроченную на сегодня, сохраняя время суток', async () => {
    const { wrapper, updateTask } = mountWith([
      makeTask('overdue-1', '2026-08-24T19:30:00'),
      makeTask('overdue-2', '2026-08-20T00:00:00'),
      makeTask('today-1', '2026-08-25T09:00:00'),
    ])

    await wrapper.find('[data-testid="reschedule-overdue"]').trigger('click')
    await flushPromises()

    expect(updateTask).toHaveBeenCalledTimes(2)
    expect(updateTask).toHaveBeenCalledWith(
      'overdue-1',
      { dueDate: new Date('2026-08-25T19:30:00'), rescheduleScope: 'this' },
      false,
    )
    expect(updateTask).toHaveBeenCalledWith(
      'overdue-2',
      { dueDate: new Date('2026-08-25T00:00:00'), rescheduleScope: 'this' },
      false,
    )
    expect(updateTask.mock.calls.map(call => call[0])).not.toContain('today-1')
  })

  it('сообщает, сколько задач не удалось перенести', async () => {
    const { wrapper, updateTask } = mountWith([
      makeTask('overdue-1', '2026-08-24T19:30:00'),
      makeTask('overdue-2', '2026-08-23T10:00:00'),
    ])
    updateTask.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)

    await wrapper.find('[data-testid="reschedule-overdue"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Не удалось перенести: 1 задача')
  })
})

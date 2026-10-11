import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import SprintBanner from '@/features/projects/ui/SprintBanner.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: 'Выпустить MVP',
    startDate: '2026-09-28',
    endDate: '2026-10-12',
    status: 'active',
    completedAt: null,
    order: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    sprintId: 'sprint-1',
    ...overrides,
  } as Task
}

describe('sprintBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 7, 15, 30))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(sprint: Sprint | null, tasks: Task[] = [], props: { canComplete?: boolean } = {}) {
    useSprintStore().lists['proj-1'] = sprint ? [sprint] : []
    useTaskStore().tasks = tasks
    return mount(SprintBanner, { props: { projectId: 'proj-1', ...props } })
  }

  it('показывает название и цель спринта', () => {
    const wrapper = setup(makeSprint())

    expect(wrapper.text()).toContain('Спринт 1')
    expect(wrapper.text()).toContain('Выпустить MVP')
  })

  it('показывает дату окончания и сколько осталось дней', () => {
    const wrapper = setup(makeSprint({ endDate: '2026-10-12' }))

    expect(wrapper.text()).toContain('до 12 окт.')
    expect(wrapper.text()).toContain('осталось 5 дней')
  })

  it('склоняет «день» по числу оставшихся дней', () => {
    const wrapper = setup(makeSprint({ endDate: '2026-10-08' }))

    expect(wrapper.text()).toContain('осталось 1 день')
  })

  it('в последний день пишет «последний день»', () => {
    const wrapper = setup(makeSprint({ endDate: '2026-10-07' }))

    expect(wrapper.text()).toContain('последний день')
    expect(wrapper.text()).not.toContain('осталось')
  })

  it('после окончания пишет «просрочен на N дн.»', () => {
    const wrapper = setup(makeSprint({ endDate: '2026-10-04' }))

    expect(wrapper.text()).toContain('просрочен на 3 дня')
  })

  it('без endDate не рисует срок', () => {
    const wrapper = setup(makeSprint({ endDate: null }))

    expect(wrapper.text()).not.toContain('до ')
    expect(wrapper.text()).not.toContain('осталось')
  })

  it('показывает прогресс только по задачам этого спринта', () => {
    const wrapper = setup(makeSprint(), [
      makeTask({ id: 't1', completed: true }),
      makeTask({ id: 't2' }),
      makeTask({ id: 't3', sprintId: 'sprint-2', completed: true }),
      makeTask({ id: 't4', sprintId: null }),
    ])

    expect(wrapper.text()).toContain('1 из 2 готово')
  })

  it('без активного спринта ничего не рендерит', () => {
    const wrapper = setup(makeSprint({ status: 'planned' }))

    expect(wrapper.text()).toBe('')
  })

  it('скрывает кнопку «Завершить спринт» без canComplete', () => {
    const wrapper = setup(makeSprint())

    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('с canComplete показывает кнопку, и клик эмитит complete', async () => {
    const wrapper = setup(makeSprint(), [], { canComplete: true })

    const button = wrapper.findAll('button').find(b => b.text() === 'Завершить спринт')
    expect(button).toBeDefined()
    await button!.trigger('click')

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})

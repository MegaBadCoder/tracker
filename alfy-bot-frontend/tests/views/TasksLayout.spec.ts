import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import TasksLayout from '@/views/TasksLayout.vue'

const mockStore = {
  projects: [] as Array<{ id: string }>,
  fetchProjects: vi.fn(),
}

vi.mock('@/features/projects/model/project-store', () => ({
  useProjectStore: () => mockStore,
}))

vi.mock('@/features/task-timer', () => ({
  TimeBlock: { template: '<div />' },
  useTimerStore: () => ({ phase: 0 }),
}))

describe('TasksLayout', () => {
  beforeEach(() => {
    mockStore.projects = []
    mockStore.fetchProjects.mockReset()
  })

  it('вызывает fetchProjects при монтировании, если список проектов пуст', async () => {
    mount(TasksLayout, {
      global: {
        stubs: {
          RouterView: { template: '<div />' },
        },
      },
    })

    await nextTick()
    expect(mockStore.fetchProjects).toHaveBeenCalledTimes(1)
  })

  it('не вызывает fetchProjects при монтировании, если проекты уже загружены', async () => {
    mockStore.projects = [{ id: 'proj-1' }]

    mount(TasksLayout, {
      global: {
        stubs: {
          RouterView: { template: '<div />' },
        },
      },
    })

    await nextTick()
    expect(mockStore.fetchProjects).not.toHaveBeenCalled()
  })
})

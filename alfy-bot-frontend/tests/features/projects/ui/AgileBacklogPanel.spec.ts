import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as groupsApi from '@/features/projects/api/groups-api'
import AgileBacklogPanel from '@/features/projects/ui/AgileBacklogPanel.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/groups-api', () => ({
  fetchGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

function makeEpic(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'epic-1',
    projectId: 'proj-1',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    columnId: null,
    groupId: null,
    order: 0,
    ...overrides,
  } as Task
}

describe('agileBacklogPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function setup(groups: BoardGroupNode[], tasks: Task[]) {
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)

    const taskStore = useTaskStore()
    taskStore.tasks = tasks

    return mount(AgileBacklogPanel, {
      props: { projectId: 'proj-1' },
      global: {
        stubs: {
          TaskCard: {
            name: 'TaskCard',
            template: '<div class="task-card">{{ task.title }}</div>',
            props: ['task', 'variant', 'dndSource'],
          },
        },
      },
    })
  }

  it('показывает в панели только задачи с columnId === null', async () => {
    const wrapper = setup(
      [],
      [
        makeTask({ id: 't1', title: 'В бэклоге', columnId: null }),
        makeTask({ id: 't2', title: 'На доске', columnId: 'col-1' }),
      ],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('В бэклоге')
    expect(wrapper.text()).not.toContain('На доске')
  })

  it('показывает бейдж эпика/истории у задачи с группой и не показывает у задачи без группы', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История X' })
    const epic = makeEpic({ id: 'epic-1', title: 'Эпик X', children: [story] })
    const wrapper = setup(
      [epic],
      [
        makeTask({ id: 't1', title: 'С группой', columnId: null, groupId: 'story-1' }),
        makeTask({ id: 't2', title: 'Без группы', columnId: null, groupId: null }),
      ],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('История X')

    const cards = wrapper.findAllComponents({ name: 'TaskCard' })
    expect(cards).toHaveLength(2)
    for (const card of cards)
      expect(card.props('dndSource')).toBe(false)
  })

  it('бросок задачи в панель отправляет columnId: null и не отправляет groupId', async () => {
    const wrapper = setup(
      [],
      [makeTask({ id: 't1', title: 'На доске', columnId: 'col-1', groupId: 'epic-1' })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const { api } = await import('@/api/client')
    vi.mocked(api.patch).mockResolvedValue({ data: {} })

    const taskStore = useTaskStore()
    const moveTaskSpy = vi.spyOn(taskStore, 'moveTask')

    const draggableComponent = wrapper.findComponent({ name: 'draggable' })
    await draggableComponent.vm.$emit('change', {
      added: { element: { id: 't1' }, newIndex: 0 },
    })

    expect(moveTaskSpy).toHaveBeenCalledWith('t1', 'proj-1', { columnId: null, order: 0 })
    const payload = moveTaskSpy.mock.calls[0][2]
    expect(payload).not.toHaveProperty('groupId')
  })
})

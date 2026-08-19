import type { BoardGroupNode, ProjectColumn } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as columnsApi from '@/features/projects/api/columns-api'
import * as groupsApi from '@/features/projects/api/groups-api'
import AgileBoardView from '@/features/projects/ui/AgileBoardView.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/columns-api', () => ({
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}))

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

function makeColumn(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
  return {
    id: 'col-1',
    projectId: 'proj-1',
    title: 'В работе',
    order: 0,
    color: null,
    ...overrides,
  }
}

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

describe('agileBoardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function setup(columns: ProjectColumn[], groups: BoardGroupNode[], tasks: Task[]) {
    vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: columns } as any)
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)

    const taskStore = useTaskStore()
    taskStore.tasks = tasks

    return mount(AgileBoardView, {
      props: { projectId: 'proj-1' },
      global: {
        stubs: {
          TaskCard: { template: '<div class="task-card">{{ task.title }}</div>', props: ['task', 'variant'] },
        },
      },
    })
  }

  it('показывает задачу истории/эпика с columnId === null в дорожке «Без колонки»', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', children: [story] })
    const wrapper = setup(
      [makeColumn()],
      [epic],
      [makeTask({ id: 't1', title: 'Задача без колонки', groupId: 'story-1', columnId: null })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Задача без колонки')
    expect(wrapper.text()).toContain('Без колонки')
  })

  it('не рендерит дорожку «Без колонки», когда все задачи привязаны к колонке', async () => {
    const wrapper = setup(
      [makeColumn()],
      [],
      [makeTask({ id: 't1', title: 'Задача с колонкой', columnId: 'col-1' })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Без колонки')
  })

  it('рендерит заголовки колонок ровно один раз на доску', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', children: [story] })
    const wrapper = setup(
      [makeColumn({ id: 'col-1', title: 'В работе' }), makeColumn({ id: 'col-2', title: 'Готово', order: 1 })],
      [epic],
      [
        makeTask({ id: 't1', groupId: 'story-1', columnId: 'col-1' }),
        makeTask({ id: 't2', groupId: null, columnId: 'col-2' }),
      ],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const inWorkHeaders = wrapper.findAll('span').filter(el => el.text() === 'В работе')
    const doneHeaders = wrapper.findAll('span').filter(el => el.text() === 'Готово')
    expect(inWorkHeaders).toHaveLength(1)
    expect(doneHeaders).toHaveLength(1)
  })

  it('на доске ровно один горизонтальный скролл-контейнер', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', children: [story] })
    const wrapper = setup(
      [makeColumn()],
      [epic],
      [makeTask({ id: 't1', groupId: 'story-1', columnId: 'col-1' })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const scrollContainers = wrapper.findAll('.overflow-x-auto')
    expect(scrollContainers).toHaveLength(1)
  })
})

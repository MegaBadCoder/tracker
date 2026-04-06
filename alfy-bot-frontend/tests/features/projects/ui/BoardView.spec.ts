import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BoardView from '@/features/projects/ui/BoardView.vue'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useTaskStore } from '@/features/tasks/model/task-store'
import * as columnsApi from '@/features/projects/api/columns-api'
import type { ProjectColumn } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'

vi.mock('@/features/projects/api/columns-api', () => ({
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    columnId: null,
    order: 0,
    ...overrides,
  } as Task
}

describe('BoardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function setup(columns: ProjectColumn[] = [], tasks: Task[] = []) {
    vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: columns } as any)

    const taskStore = useTaskStore()
    taskStore.tasks = tasks

    return mount(BoardView, {
      props: { projectId: 'proj-1' },
      global: {
        stubs: {
          TaskCard: { template: '<div class="task-card">{{ task.title }}</div>', props: ['task', 'variant'] },
        },
      },
    })
  }

  it('рендерит колонки проекта', async () => {
    const wrapper = setup(
      [makeColumn({ id: 'col-1', title: 'В работе' }), makeColumn({ id: 'col-2', title: 'Готово', order: 1 })],
      [],
    )
    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('В работе')
    expect(wrapper.text()).toContain('Готово')
  })

  it('показывает "Без раздела" колонку', async () => {
    const wrapper = setup([], [makeTask({ columnId: null })])
    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('Без раздела')
  })

  it('показывает кнопку добавления колонки', async () => {
    const wrapper = setup()
    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('Добавить колонку')
  })

  it('группирует задачи по columnId', async () => {
    const wrapper = setup(
      [makeColumn({ id: 'col-1', title: 'В работе' })],
      [
        makeTask({ id: 't1', title: 'Задача 1', columnId: 'col-1' }),
        makeTask({ id: 't2', title: 'Задача 2', columnId: null }),
      ],
    )
    await vi.dynamicImportSettled()

    const text = wrapper.text()
    expect(text).toContain('Задача 1')
    expect(text).toContain('Задача 2')
  })

  it('показывает пустое состояние без колонок и задач', async () => {
    const wrapper = setup([], [])
    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('Без раздела')
    expect(wrapper.text()).toContain('Добавить колонку')
  })
})

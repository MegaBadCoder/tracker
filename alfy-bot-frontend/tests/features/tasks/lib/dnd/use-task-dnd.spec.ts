import type { Project } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useTaskDnd } from '@/features/tasks/lib/dnd/use-task-dnd'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'board',
    type: 'simple',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    ...overrides,
  }
}

function makeDropEl(
  attrs: Record<string, string>,
  rect: { left: number, top: number, right: number, bottom: number },
): HTMLElement {
  const el = document.createElement('a')
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
  el.getBoundingClientRect = vi.fn(() => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => {},
  }))
  document.body.appendChild(el)
  return el
}

function movePointer(x: number, y: number): void {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }))
}

describe('useTaskDnd — запрет переноса из agile-проекта', () => {
  const dnd = useTaskDnd()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    dnd.cancel()
    document.body.innerHTML = ''
  })

  function startDragWithTask(task: Task): void {
    dnd.start(
      {
        task,
        pointerType: 'mouse',
        originRect: new DOMRect(0, 0, 10, 10),
        ghostOffset: { x: 0, y: 0 },
        pointerId: 1,
      },
      { x: -1000, y: -1000 },
    )
  }

  it('не подсвечивает обычный проект как цель и не переносит задачу при отпускании', () => {
    const projectStore = useProjectStore()
    projectStore.projects.push(makeProject({ id: 'agile-1', type: 'agile' }))
    projectStore.projects.push(makeProject({ id: 'simple-1', type: 'simple' }))

    const taskStore = useTaskStore()
    const task = makeTask({ id: 'task-1', projectId: 'agile-1' })
    taskStore.tasks.push(task)

    makeDropEl(
      { 'data-drop-kind': 'project', 'data-project-id': 'simple-1', 'data-project-type': 'simple' },
      { left: 0, top: 0, right: 100, bottom: 40 },
    )

    startDragWithTask(task)
    movePointer(50, 20)

    expect(dnd.state.hoveredTarget).toBeNull()

    dnd.commit()

    expect(api.patch).not.toHaveBeenCalled()
    expect(task.projectId).toBe('agile-1')
  })

  it('не подсвечивает Входящие как цель и не переносит задачу при отпускании', () => {
    const projectStore = useProjectStore()
    projectStore.projects.push(makeProject({ id: 'agile-1', type: 'agile' }))

    const taskStore = useTaskStore()
    const task = makeTask({ id: 'task-1', projectId: 'agile-1' })
    taskStore.tasks.push(task)

    makeDropEl(
      { 'data-drop-kind': 'inbox' },
      { left: 0, top: 0, right: 100, bottom: 40 },
    )

    startDragWithTask(task)
    movePointer(50, 20)

    expect(dnd.state.hoveredTarget).toBeNull()

    dnd.commit()

    expect(api.patch).not.toHaveBeenCalled()
    expect(task.projectId).toBe('agile-1')
  })

  it('подсвечивает другой agile-проект и переносит в него задачу', async () => {
    const projectStore = useProjectStore()
    projectStore.projects.push(makeProject({ id: 'agile-1', type: 'agile' }))
    projectStore.projects.push(makeProject({ id: 'agile-2', type: 'agile' }))

    const taskStore = useTaskStore()
    const task = makeTask({ id: 'task-1', projectId: 'agile-1' })
    taskStore.tasks.push(task)

    makeDropEl(
      { 'data-drop-kind': 'project', 'data-project-id': 'agile-2', 'data-project-type': 'agile' },
      { left: 0, top: 0, right: 100, bottom: 40 },
    )

    startDragWithTask(task)
    movePointer(50, 20)

    expect(dnd.state.hoveredTarget?.id).toBe('project:agile-2')

    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    dnd.commit()
    await vi.waitFor(() => {
      expect(api.patch).toHaveBeenCalled()
    })

    expect(api.patch).toHaveBeenCalledWith(
      '/projects/agile-2/tasks/task-1/move',
      expect.objectContaining({ columnId: null }),
    )
    expect(task.projectId).toBe('agile-2')
  })

  it('разрешает перенос из обычного проекта в agile-проект', async () => {
    const projectStore = useProjectStore()
    projectStore.projects.push(makeProject({ id: 'simple-1', type: 'simple' }))
    projectStore.projects.push(makeProject({ id: 'agile-1', type: 'agile' }))

    const taskStore = useTaskStore()
    const task = makeTask({ id: 'task-1', projectId: 'simple-1' })
    taskStore.tasks.push(task)

    makeDropEl(
      { 'data-drop-kind': 'project', 'data-project-id': 'agile-1', 'data-project-type': 'agile' },
      { left: 0, top: 0, right: 100, bottom: 40 },
    )

    startDragWithTask(task)
    movePointer(50, 20)

    expect(dnd.state.hoveredTarget?.id).toBe('project:agile-1')

    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    dnd.commit()
    await vi.waitFor(() => {
      expect(api.patch).toHaveBeenCalled()
    })

    expect(task.projectId).toBe('agile-1')
  })
})

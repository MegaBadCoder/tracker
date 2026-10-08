import type { ProjectTreeNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '@/features/projects/model/project-store'
import ProjectTreeItem from '@/features/projects/ui/ProjectTreeItem.vue'
import { useTaskDnd } from '@/features/tasks/lib/dnd/use-task-dnd'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => ({ params: {} }),
}))

function makeNode(overrides: Partial<ProjectTreeNode> = {}): ProjectTreeNode {
  return {
    id: 'target-1',
    parentId: null,
    title: 'Цель',
    description: null,
    viewMode: 'board',
    type: 'simple',
    icon: null,
    color: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

function makeAgileSourceTask(): Task {
  return { id: 'task-1', title: 'Задача', completed: false, projectId: 'agile-source' }
}

function mockRect(el: HTMLElement, rect: { left: number, top: number, right: number, bottom: number }): void {
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
}

describe('projectTreeItem — подсветка цели переноса', () => {
  const dnd = useTaskDnd()

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    dnd.cancel()
    document.body.innerHTML = ''
  })

  it('не подсвечивает обычный проект как цель, когда тащат задачу из agile-проекта', async () => {
    const projectStore = useProjectStore()
    projectStore.projects.push({ id: 'agile-source', parentId: null, title: 'Источник', description: null, viewMode: 'board', type: 'agile', icon: null, color: null, order: 0 })

    const wrapper = mount(ProjectTreeItem, {
      attachTo: document.body,
      props: { node: makeNode({ type: 'simple' }), depth: 0 },
    })

    const link = wrapper.get('a').element as HTMLElement
    mockRect(link, { left: 0, top: 0, right: 100, bottom: 40 })

    dnd.start(
      { task: makeAgileSourceTask(), pointerType: 'mouse', originRect: new DOMRect(0, 0, 10, 10), ghostOffset: { x: 0, y: 0 }, pointerId: 1 },
      { x: -1000, y: -1000 },
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 20 }))
    await wrapper.vm.$nextTick()

    expect(link.className).not.toContain('ring-primary')
  })

  it('подсвечивает agile-проект как цель, когда тащат задачу из agile-проекта', async () => {
    const projectStore = useProjectStore()
    projectStore.projects.push({ id: 'agile-source', parentId: null, title: 'Источник', description: null, viewMode: 'board', type: 'agile', icon: null, color: null, order: 0 })

    const wrapper = mount(ProjectTreeItem, {
      attachTo: document.body,
      props: { node: makeNode({ type: 'agile' }), depth: 0 },
    })

    const link = wrapper.get('a').element as HTMLElement
    mockRect(link, { left: 0, top: 0, right: 100, bottom: 40 })

    dnd.start(
      { task: makeAgileSourceTask(), pointerType: 'mouse', originRect: new DOMRect(0, 0, 10, 10), ghostOffset: { x: 0, y: 0 }, pointerId: 1 },
      { x: -1000, y: -1000 },
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 20 }))
    await wrapper.vm.$nextTick()

    expect(link.className).toContain('ring-primary')
  })
})

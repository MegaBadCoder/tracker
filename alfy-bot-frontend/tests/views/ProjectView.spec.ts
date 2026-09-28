import type { Project } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '@/features/projects/model/project-store'
import AgileBoardView from '@/features/projects/ui/AgileBoardView.vue'
import BoardView from '@/features/projects/ui/BoardView.vue'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'
import ProjectView from '@/views/ProjectView.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'proj-1' } }),
  useRouter: () => ({ back: vi.fn() }),
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list',
    type: 'simple',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  BoardView: true,
  AgileBoardView: true,
  AgileBacklogPanel: true,
  GroupedListView: true,
  TaskForm: true,
  TaskDetailDialog: true,
  TaskListOptionsMenu: true,
  TaskCard: true,
}

describe('ProjectView — тип проекта решает, что рендерится', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('рендерит ViewModeToggle и не рендерит agile-доску для обычного проекта', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ type: 'simple' })]

    const wrapper = mount(ProjectView, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(ViewModeToggle).exists()).toBe(true)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(false)
  })

  it('рендерит agile-доску и скрывает ViewModeToggle для agile-проекта, даже если его viewMode не agile', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ type: 'agile', viewMode: 'list' })]

    const wrapper = mount(ProjectView, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(ViewModeToggle).exists()).toBe(false)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
  })

  it('рендерит agile-доску для agile-проекта с legacy viewMode = board', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ type: 'agile', viewMode: 'board' })]

    const wrapper = mount(ProjectView, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(ViewModeToggle).exists()).toBe(false)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
    expect(wrapper.findComponent(BoardView).exists()).toBe(false)
  })
})

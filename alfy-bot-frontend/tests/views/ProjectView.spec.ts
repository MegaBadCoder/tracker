import type { Project, Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import AgileBoardView from '@/features/projects/ui/AgileBoardView.vue'
import BoardView from '@/features/projects/ui/BoardView.vue'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'
import SprintBanner from '@/features/projects/ui/SprintBanner.vue'
import SprintCompleteDialog from '@/features/projects/ui/SprintCompleteDialog.vue'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
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
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
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

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: null,
    startDate: '2026-09-28',
    endDate: '2026-10-11',
    status: 'active',
    completedAt: null,
    order: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    ...overrides,
  }
}

const stubs = {
  BoardView: true,
  AgileBoardView: true,
  SprintBanner: true,
  GroupedListView: true,
  TaskForm: { name: 'TaskForm', template: '<div />', methods: { resetForm() {} } },
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

  it('рендерит agile-доску и скрывает ViewModeToggle для agile-проекта с активным спринтом, даже если его viewMode не agile', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ type: 'agile', viewMode: 'list' })]
    useSprintStore().lists['proj-1'] = [makeSprint()]

    const wrapper = mount(ProjectView, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(ViewModeToggle).exists()).toBe(false)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
  })

  it('рендерит agile-доску для agile-проекта с активным спринтом и legacy viewMode = board', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ type: 'agile', viewMode: 'board' })]
    useSprintStore().lists['proj-1'] = [makeSprint()]

    const wrapper = mount(ProjectView, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(ViewModeToggle).exists()).toBe(false)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
    expect(wrapper.findComponent(BoardView).exists()).toBe(false)
  })
})

describe('projectView — agile-проект и активный спринт', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: [] })
  })

  function mountAgile(sprints: Sprint[]) {
    useProjectStore().projects = [makeProject({ type: 'agile' })]
    useSprintStore().lists['proj-1'] = sprints
    return mount(ProjectView, { global: { stubs } })
  }

  it('без активного спринта показывает пустое состояние без доски и формы задачи', async () => {
    const wrapper = mountAgile([makeSprint({ id: 's-planned', status: 'planned', startDate: null, endDate: null })])
    await flushPromises()

    expect(wrapper.text()).toContain('Нет активного спринта')
    expect(wrapper.text()).toContain('Выберите задачи в бэклоге и начните спринт')
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(false)
    expect(wrapper.findComponent(TaskForm).exists()).toBe(false)
    expect(wrapper.findComponent(SprintBanner).exists()).toBe(false)
  })

  it('баннер активного спринта разрешает «Завершить спринт» и открывает диалог завершения', async () => {
    const wrapper = mountAgile([makeSprint({ id: 'sprint-1' })])
    await flushPromises()
    expect(wrapper.findComponent(SprintCompleteDialog).exists()).toBe(false)

    const banner = wrapper.findComponent(SprintBanner)
    expect(banner.props('canComplete')).toBe(true)

    banner.vm.$emit('complete')
    await flushPromises()

    const dialog = wrapper.findComponent(SprintCompleteDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('open')).toBe(true)
    expect((dialog.props('sprint') as Sprint).id).toBe('sprint-1')
    wrapper.unmount()
  })

  it('кнопка «Перейти в бэклог» ведёт на маршрут бэклога проекта', async () => {
    const wrapper = mountAgile([])
    await flushPromises()

    const link = wrapper.findAllComponents({ name: 'RouterLink' })
      .find(l => l.text() === 'Перейти в бэклог')
    expect(link?.props('to')).toEqual({ name: 'tasks-project-backlog', params: { projectId: 'proj-1' } })
  })

  it('с активным спринтом рендерит SprintBanner, форму задачи и доску', async () => {
    const wrapper = mountAgile([makeSprint()])
    await flushPromises()

    expect(wrapper.findComponent(SprintBanner).exists()).toBe(true)
    expect(wrapper.findComponent(TaskForm).exists()).toBe(true)
    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Нет активного спринта')
  })

  it('пока спринты загружаются, показывает спиннер, а не пустое состояние', async () => {
    useProjectStore().projects = [makeProject({ type: 'agile' })]
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
    const wrapper = mount(ProjectView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Нет активного спринта')
  })

  it('повторная загрузка задач не снимает доску с экрана, если задачи уже есть', async () => {
    const wrapper = mountAgile([makeSprint({ id: 'sprint-1' })])
    await flushPromises()

    const taskStore = useTaskStore()
    taskStore.tasks = [{ id: 't1', title: 'Задача', completed: false, projectId: 'proj-1', sprintId: 'sprint-1' } as Task]
    taskStore.loading = true
    await flushPromises()

    expect(wrapper.findComponent(AgileBoardView).exists()).toBe(true)
    expect(wrapper.find('.animate-spin').exists()).toBe(false)
  })

  it('не рендерит ProjectTabs и боковую панель у обычного проекта', async () => {
    useProjectStore().projects = [makeProject({ type: 'simple' })]
    const wrapper = mount(ProjectView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.findComponent(ProjectTabs).exists()).toBe(false)
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('рендерит ProjectTabs у agile-проекта в обоих состояниях', async () => {
    const empty = mountAgile([])
    await flushPromises()
    expect(empty.findComponent(ProjectTabs).exists()).toBe(true)

    const active = mountAgile([makeSprint()])
    await flushPromises()
    expect(active.findComponent(ProjectTabs).exists()).toBe(true)
  })

  it('задача из формы agile-проекта уходит с sprintId активного спринта', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'task-new', title: 'Новая', completed: false, projectId: 'proj-1', sprintId: 'sprint-1' },
    })
    const wrapper = mountAgile([makeSprint({ id: 'sprint-1' })])
    await flushPromises()

    wrapper.findComponent(TaskForm).vm.$emit('submit', { title: 'Новая', completed: false })
    await flushPromises()

    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      title: 'Новая',
      projectId: 'proj-1',
      sprintId: 'sprint-1',
    }))
  })

  it('задача из формы обычного проекта уходит без sprintId', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'task-new', title: 'Новая', completed: false, projectId: 'proj-1' },
    })
    useProjectStore().projects = [makeProject({ type: 'simple' })]
    const wrapper = mount(ProjectView, { global: { stubs } })
    await flushPromises()

    wrapper.findComponent(TaskForm).vm.$emit('submit', { title: 'Новая', completed: false })
    await flushPromises()

    const body = vi.mocked(api.post).mock.calls[0]![1] as Record<string, unknown>
    expect(body).not.toHaveProperty('sprintId')
  })
})

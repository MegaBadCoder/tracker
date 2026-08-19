import type { Project } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoalPicker from '@/features/goals/ui/GoalPicker.vue'
import { useProjectStore } from '@/features/projects/model/project-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/api/goals', () => ({
  fetchGoals: vi.fn().mockResolvedValue([]),
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'board',
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
    projectId: null,
    goalIds: [1],
    ...overrides,
  } as Task
}

const stubs = {
  ProjectPicker: true,
  ProjectPickerContent: true,
  GoalPickerContent: true,
  RecurrencePicker: true,
  RecurrencePickerContent: true,
  PomodoroSettings: true,
  TagsEditor: true,
  PriorityPickerContent: true,
  DeadlinePickerContent: true,
  DueDatePickerContent: true,
  LocationPickerContent: true,
  Calendar: true,
}

describe('taskDetailDialog — блок целей и agile-проекты', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('показывает GoalPicker, когда проект задачи в режиме board', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ id: 'proj-board', viewMode: 'board' })]

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-board' }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(GoalPicker).exists()).toBe(true)
  })

  it('скрывает GoalPicker, когда проект задачи в режиме agile', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ id: 'proj-agile', viewMode: 'agile' })]

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile' }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(GoalPicker).exists()).toBe(false)
  })

  it('показывает GoalPicker для задачи без проекта (Inbox)', async () => {
    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: null }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(GoalPicker).exists()).toBe(true)
  })

  it('возвращает GoalPicker при переключении проекта обратно в board', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [
      makeProject({ id: 'proj-agile', viewMode: 'agile' }),
      makeProject({ id: 'proj-board', viewMode: 'board' }),
    ]

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile', goalIds: [1, 2] }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(GoalPicker).exists()).toBe(false)

    await wrapper.setProps({ task: makeTask({ projectId: 'proj-board', goalIds: [1, 2] }) })
    await flushPromises()

    expect(wrapper.findComponent(GoalPicker).exists()).toBe(true)
    expect(wrapper.findComponent(GoalPicker).props('modelValue')).toEqual([1, 2])
  })
})

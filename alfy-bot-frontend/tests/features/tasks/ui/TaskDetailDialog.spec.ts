import type { BoardGroupNode, Project, Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GoalPicker from '@/features/goals/ui/GoalPicker.vue'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import GroupPicker from '@/features/projects/ui/GroupPicker.vue'
import SprintPicker from '@/features/projects/ui/SprintPicker.vue'
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

  it('скрывает GoalPicker, когда проект задачи имеет тип agile', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ id: 'proj-agile', type: 'agile', viewMode: 'list' })]

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
      makeProject({ id: 'proj-agile', type: 'agile', viewMode: 'list' }),
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

function makeAgileProject(overrides: Partial<Project> = {}): Project {
  return makeProject({ id: 'proj-agile', type: 'agile', viewMode: 'list', title: 'Проект', ...overrides })
}

function makeGroupNode(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'epic-1',
    projectId: 'proj-agile',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

describe('taskDetailDialog — эпик/история agile-задачи', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('agile-задача в истории показывает крошки и поле «Эпик / История»', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeAgileProject()]
    const groupStore = useGroupStore()
    const story = makeGroupNode({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    groupStore.trees['proj-agile'] = [makeGroupNode({ children: [story] })]

    wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile', groupId: 'story-1' }),
        open: true,
      },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    const crumbButtons = Array.from(document.querySelectorAll('button[aria-label^="Открыть"]'))
    expect(crumbButtons.map(b => b.textContent?.trim())).toEqual(['Эпик', 'История'])
    expect(document.body.textContent).toContain('Проект')
    expect(document.body.textContent).toContain('Эпик / История')
    expect(document.body.textContent).toContain('Эпик › История')
  })

  it('задача обычного проекта не показывает ни крошек, ни поля', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeProject({ id: 'proj-simple' })]

    wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-simple' }),
        open: true,
      },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(document.querySelectorAll('button[aria-label^="Открыть"]').length).toBe(0)
    expect(wrapper.findComponent(GroupPicker).exists()).toBe(false)
    expect(document.body.textContent).not.toContain('Эпик / История')
  })

  it('задача во Входящих не показывает ни крошек, ни поля', async () => {
    wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: null }),
        open: true,
      },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(document.querySelectorAll('button[aria-label^="Открыть"]').length).toBe(0)
    expect(wrapper.findComponent(GroupPicker).exists()).toBe(false)
    expect(document.body.textContent).not.toContain('Эпик / История')
  })

  it('выбор истории в GroupPicker эмитит обновление с groupId', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeAgileProject()]
    const groupStore = useGroupStore()
    const story = makeGroupNode({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    groupStore.trees['proj-agile'] = [makeGroupNode({ children: [story] })]

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile', groupId: null }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    await wrapper.findComponent(GroupPicker).vm.$emit('update:modelValue', 'story-1')

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.at(-1)![0].groupId).toBe('story-1')
  })

  it('«Без эпика» эмитит groupId: null', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeAgileProject()]
    const groupStore = useGroupStore()
    groupStore.trees['proj-agile'] = [makeGroupNode()]

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile', groupId: 'epic-1' }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    await wrapper.findComponent(GroupPicker).vm.$emit('update:modelValue', null)

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.at(-1)![0].groupId).toBeNull()
  })

  it('клик по эпику в крошках закрывает диалог и открывает карточку группы', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [makeAgileProject()]
    const groupStore = useGroupStore()
    const story = makeGroupNode({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    groupStore.trees['proj-agile'] = [makeGroupNode({ children: [story] })]

    wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile', groupId: 'story-1' }),
        open: true,
      },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    const epicButton = document.querySelector('button[aria-label="Открыть эпик"]') as HTMLButtonElement
    epicButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-agile', groupId: 'epic-1' })
  })

  it('смена проекта обнуляет локальное поле группы', async () => {
    const projectStore = useProjectStore()
    projectStore.projects = [
      makeAgileProject({ id: 'proj-agile-1' }),
      makeAgileProject({ id: 'proj-agile-2' }),
    ]
    const groupStore = useGroupStore()
    groupStore.trees['proj-agile-1'] = [makeGroupNode({ id: 'epic-1', projectId: 'proj-agile-1' })]
    groupStore.trees['proj-agile-2'] = []

    const wrapper = mount(TaskDetailDialog, {
      props: {
        task: makeTask({ projectId: 'proj-agile-1', groupId: 'epic-1' }),
        open: true,
      },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(GroupPicker).props('modelValue')).toBe('epic-1')

    await wrapper.findComponent({ name: 'ProjectPicker' }).vm.$emit('update:modelValue', 'proj-agile-2')
    await flushPromises()

    expect(wrapper.findComponent(GroupPicker).props('modelValue')).toBeNull()

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.length).toBe(1)
    expect(updates[0]![0].projectId).toBe('proj-agile-2')
  })
})

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-agile',
    name: 'Спринт 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planned',
    completedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('taskDetailDialog — спринт agile-задачи', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('agile-задача показывает поле «Спринт» с именем спринта', async () => {
    useProjectStore().projects = [makeAgileProject()]
    useSprintStore().lists['proj-agile'] = [makeSprint({ id: 'sprint-2', name: 'Спринт 2', status: 'active' })]

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-agile', sprintId: 'sprint-2' }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.findComponent(SprintPicker).exists()).toBe(true)
    expect(document.body.textContent).toContain('Спринт 2')
  })

  it('задача обычного проекта не показывает поле «Спринт»', async () => {
    useProjectStore().projects = [makeProject({ id: 'proj-simple' })]

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-simple' }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.findComponent(SprintPicker).exists()).toBe(false)
  })

  it('задача во Входящих не показывает поле «Спринт»', async () => {
    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: null }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.findComponent(SprintPicker).exists()).toBe(false)
  })

  it('выбор спринта эмитит обновление с sprintId', async () => {
    useProjectStore().projects = [makeAgileProject()]
    useSprintStore().lists['proj-agile'] = [makeSprint({ id: 'sprint-2', name: 'Спринт 2' })]

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-agile', sprintId: null }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    await wrapper.findComponent(SprintPicker).vm.$emit('update:modelValue', 'sprint-2')
    await flushPromises()

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.at(-1)![0].sprintId).toBe('sprint-2')
  })

  it('«Бэклог» эмитит sprintId: null', async () => {
    useProjectStore().projects = [makeAgileProject()]
    useSprintStore().lists['proj-agile'] = [makeSprint({ id: 'sprint-2', status: 'active' })]

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-agile', sprintId: 'sprint-2' }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    await wrapper.findComponent(SprintPicker).vm.$emit('update:modelValue', null)
    await flushPromises()

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.at(-1)![0].sprintId).toBeNull()
  })

  it('задача в закрытом спринте показывает «Спринт 1 (закрыт)»', async () => {
    useProjectStore().projects = [makeAgileProject()]
    useSprintStore().lists['proj-agile'] = [makeSprint({ id: 'sprint-1', name: 'Спринт 1', status: 'closed' })]

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-agile', sprintId: 'sprint-1' }), open: true },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()

    expect(document.body.textContent).toContain('Спринт 1 (закрыт)')
  })

  it('смена проекта обнуляет локальное поле спринта без отдельного PATCH', async () => {
    useProjectStore().projects = [
      makeAgileProject({ id: 'proj-agile-1' }),
      makeAgileProject({ id: 'proj-agile-2' }),
    ]
    const sprintStore = useSprintStore()
    sprintStore.lists['proj-agile-1'] = [makeSprint({ id: 'sprint-1', projectId: 'proj-agile-1', status: 'active' })]
    sprintStore.lists['proj-agile-2'] = []

    wrapper = mount(TaskDetailDialog, {
      props: { task: makeTask({ projectId: 'proj-agile-1', sprintId: 'sprint-1' }), open: true },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.findComponent(SprintPicker).props('modelValue')).toBe('sprint-1')

    await wrapper.findComponent({ name: 'ProjectPicker' }).vm.$emit('update:modelValue', 'proj-agile-2')
    await flushPromises()

    expect(wrapper.findComponent(SprintPicker).props('modelValue')).toBeNull()

    const updates = wrapper.emitted('update') as Array<[Task]>
    expect(updates.length).toBe(1)
    expect(updates[0]![0].projectId).toBe('proj-agile-2')
  })
})

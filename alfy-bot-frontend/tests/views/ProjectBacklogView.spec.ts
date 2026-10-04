import type { BoardGroupNode, Project, ProjectColumn, Sprint } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useConfirm } from '@/composables/useConfirm'
import * as columnsApi from '@/features/projects/api/columns-api'
import * as groupsApi from '@/features/projects/api/groups-api'
import { sprintDeletionMessage } from '@/features/projects/lib/sprint'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import BacklogEpicsPanel from '@/features/projects/ui/BacklogEpicsPanel.vue'
import SprintBlock from '@/features/projects/ui/SprintBlock.vue'
import SprintCompleteDialog from '@/features/projects/ui/SprintCompleteDialog.vue'
import SprintFormDialog from '@/features/projects/ui/SprintFormDialog.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import ProjectBacklogView from '@/views/ProjectBacklogView.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

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

const routerReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'proj-1' }, name: 'tasks-project-backlog' }),
  useRouter: () => ({ replace: routerReplace }),
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
    type: 'agile',
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

function rawTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    sprintId: null,
    columnId: null,
    groupId: null,
    order: 0,
    ...overrides,
  }
}

const stubs = {
  TaskDetailDialog: true,
  TaskListOptionsMenu: true,
  BacklogEpicsPanel: true,
}

async function mountView(sprints: Sprint[], tasks: Record<string, unknown>[] = [], project: Project = makeProject()) {
  vi.mocked(api.get).mockResolvedValue({ data: tasks })
  vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [] as ProjectColumn[] } as any)
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [] as BoardGroupNode[] } as any)
  useProjectStore().projects = [project]
  useSprintStore().lists['proj-1'] = sprints

  const wrapper = mount(ProjectBacklogView, { global: { stubs }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('projectBacklogView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('рендерит блоки в порядке: активный спринт, запланированные по order, бэклог', async () => {
    const wrapper = await mountView([
      makeSprint({ id: 'planned-2', name: 'Позже', status: 'planned', order: 2, startDate: null, endDate: null }),
      makeSprint({ id: 'active', name: 'Активный', status: 'active', order: 0 }),
      makeSprint({ id: 'planned-1', name: 'Раньше', status: 'planned', order: 1, startDate: null, endDate: null }),
    ])

    const ids = wrapper.findAllComponents(SprintBlock).map(b => b.attributes('data-sprint-id'))
    expect(ids).toEqual(['active', 'planned-1', 'planned-2', 'backlog'])
    wrapper.unmount()
  })

  it('раскладывает задачи по блокам и не показывает закрытые спринты и чужие проекты', async () => {
    const wrapper = await mountView(
      [
        makeSprint({ id: 'active', status: 'active' }),
        makeSprint({ id: 'planned', status: 'planned', order: 1, startDate: null, endDate: null }),
        makeSprint({ id: 'closed', name: 'Закрытый', status: 'closed', order: 2 }),
      ],
      [
        rawTask({ id: 'a', title: 'В активном', sprintId: 'active' }),
        rawTask({ id: 'p', title: 'В запланированном', sprintId: 'planned' }),
        rawTask({ id: 'b', title: 'В бэклоге', sprintId: null }),
        rawTask({ id: 'c', title: 'В закрытом', sprintId: 'closed' }),
        rawTask({ id: 'o', title: 'Чужая', projectId: 'proj-2', sprintId: null }),
      ],
    )

    const block = (id: string) => wrapper.find(`[data-sprint-id="${id}"]`).text()
    expect(block('active')).toContain('В активном')
    expect(block('active')).not.toContain('В запланированном')
    expect(block('planned')).toContain('В запланированном')
    expect(block('backlog')).toContain('В бэклоге')
    expect(block('backlog')).not.toContain('Чужая')
    expect(wrapper.text()).not.toContain('В закрытом')
    expect(wrapper.text()).not.toContain('Чужая')
    wrapper.unmount()
  })

  it('«Создать спринт» вызывает createSprint без названия', async () => {
    const wrapper = await mountView([makeSprint()])
    vi.mocked(api.post).mockResolvedValue({ data: makeSprint({ id: 'new', status: 'planned' }) })
    const createSpy = vi.spyOn(useSprintStore(), 'createSprint')

    const button = wrapper.findAll('button').find(b => b.text().includes('Создать спринт'))
    await button!.trigger('click')
    await flushPromises()

    expect(createSpy).toHaveBeenCalledWith('proj-1', {})
    wrapper.unmount()
  })

  it('«+ задача» в блоке спринта создаёт задачу с sprintId блока, в бэклоге — с null', async () => {
    const wrapper = await mountView([makeSprint({ id: 'active' })])
    vi.mocked(api.post).mockImplementation(async (_url, body: any) => ({ data: { id: `srv-${body.title}`, ...body } }))

    const blocks = wrapper.findAllComponents(SprintBlock)
    blocks[0]!.vm.$emit('createTask', 'В спринт')
    blocks[1]!.vm.$emit('createTask', 'В бэклог')
    await flushPromises()

    const bodies = vi.mocked(api.post).mock.calls.map(c => c[1] as Record<string, unknown>)
    expect(bodies).toContainEqual(expect.objectContaining({ title: 'В спринт', sprintId: 'active', projectId: 'proj-1' }))
    expect(bodies).toContainEqual(expect.objectContaining({ title: 'В бэклог', sprintId: null, projectId: 'proj-1' }))
    wrapper.unmount()
  })

  it('фильтрует все блоки по эпику и оставляет полный счётчик спринта', async () => {
    const wrapper = await mountView([makeSprint({ id: 'active' })], [rawTask({ id: 'a', groupId: 'epic-a', sprintId: 'active' }), rawTask({ id: 'b', groupId: 'epic-b', sprintId: 'active' }), rawTask({ id: 'c', groupId: null, sprintId: null })])
    useGroupStore().trees['proj-1'] = [{ id: 'epic-a', children: [] }, { id: 'epic-b', children: [] }] as BoardGroupNode[]
    wrapper.getComponent(BacklogEpicsPanel).vm.$emit('update:modelValue', 'epic-a')
    await flushPromises()
    expect(wrapper.findAll('[data-task-id]').map(row => row.attributes('data-task-id'))).toEqual(['a'])
    expect(wrapper.get('[data-sprint-id="active"] [data-testid="sprint-counter"]').text()).toBe('0 из 2 готово')
    expect(wrapper.get('[data-sprint-id="active"] [data-testid="visible-count"]').text()).toBe('Задач по фильтру: 1')
    wrapper.getComponent(BacklogEpicsPanel).vm.$emit('update:modelValue', 'none')
    await flushPromises()
    expect(wrapper.findAll('[data-task-id]').map(row => row.attributes('data-task-id'))).toEqual(['c'])
    wrapper.unmount()
  })

  it('создание из истории передаёт группу и спринт без явного релиза', async () => {
    const wrapper = await mountView([makeSprint({ id: 'active' })])
    vi.mocked(api.post).mockImplementation(async (_url, body: any) => ({ data: { id: 'new-task', ...body } }))
    wrapper.findAllComponents(SprintBlock)[0]!.vm.$emit('createStoryTask', 'story-1', 'Новая в истории')
    await flushPromises()
    const payload = vi.mocked(api.post).mock.calls.find(call => call[0] === '/tasks')?.[1] as Record<string, unknown>
    expect(payload).toMatchObject({ groupId: 'story-1', sprintId: 'active', projectId: 'proj-1' })
    expect(Object.hasOwn(payload, 'releaseId')).toBe(false)
    wrapper.unmount()
  })

  it('перенос задачи шлёт PATCH с sprintId блока', async () => {
    const wrapper = await mountView(
      [makeSprint({ id: 'active' })],
      [rawTask({ id: 'b', title: 'В бэклоге', sprintId: null })],
    )
    vi.mocked(api.patch).mockResolvedValue({ data: rawTask({ id: 'b', sprintId: 'active', columnId: 'col-1' }) })

    wrapper.findAllComponents(SprintBlock)[0]!.vm.$emit('moveTask', 'b', 'active')
    await flushPromises()

    expect(api.patch).toHaveBeenCalledWith('/tasks/b', { sprintId: 'active' })
    wrapper.unmount()
  })

  it('не-agile проект перенаправляется на tasks-project', async () => {
    const wrapper = await mountView([], [], makeProject({ type: 'simple' }))

    expect(routerReplace).toHaveBeenCalledWith({ name: 'tasks-project', params: { projectId: 'proj-1' } })
    wrapper.unmount()
  })

  it('agile-проект не перенаправляется', async () => {
    const wrapper = await mountView([makeSprint()])

    expect(routerReplace).not.toHaveBeenCalled()
    expect(wrapper.findComponent(BacklogEpicsPanel).exists()).toBe(true)
    wrapper.unmount()
  })

  it('клик по строке задачи открывает TaskDetailDialog', async () => {
    const wrapper = await mountView(
      [makeSprint({ id: 'active' })],
      [rawTask({ id: 'a', title: 'Открыть меня', sprintId: 'active' })],
    )
    expect(wrapper.findComponent(TaskDetailDialog).props('open')).toBe(false)

    await wrapper.find('[data-task-id="a"]').trigger('click')

    const dialog = wrapper.findComponent(TaskDetailDialog)
    expect(dialog.props('open')).toBe(true)
    expect((dialog.props('task') as { id: string }).id).toBe('a')
    wrapper.unmount()
  })
})

describe('projectBacklogView — действия со спринтами', () => {
  const planned = (overrides: Partial<Sprint> = {}) =>
    makeSprint({ id: 'planned', name: 'Спринт 2', status: 'planned', order: 1, startDate: null, endDate: null, ...overrides })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('«Начать спринт» открывает форму в режиме start для выбранного спринта', async () => {
    const wrapper = await mountView([planned()])
    expect(wrapper.findComponent(SprintFormDialog).exists()).toBe(false)

    const button = wrapper.findAll('button').find(b => b.text() === 'Начать спринт')
    await button!.trigger('click')
    await flushPromises()

    const dialog = wrapper.findComponent(SprintFormDialog)
    expect(dialog.props('mode')).toBe('start')
    expect(dialog.props('projectId')).toBe('proj-1')
    expect((dialog.props('sprint') as Sprint).id).toBe('planned')
    wrapper.unmount()
  })

  it('при активном спринте «Начать спринт» не показывается, а у активного есть «Завершить»', async () => {
    const wrapper = await mountView([makeSprint(), planned()])

    expect(wrapper.findAll('button').some(b => b.text() === 'Начать спринт')).toBe(false)
    const complete = wrapper.findAll('button').find(b => b.text() === 'Завершить')
    expect(complete).toBeTruthy()

    await complete!.trigger('click')
    await flushPromises()

    const dialog = wrapper.findComponent(SprintCompleteDialog)
    expect((dialog.props('sprint') as Sprint).id).toBe('sprint-1')
    wrapper.unmount()
  })

  it('«Изменить» открывает форму в режиме edit', async () => {
    const wrapper = await mountView([planned()])

    wrapper.findAllComponents(SprintBlock)[0]!.vm.$emit('edit')
    await flushPromises()

    expect(wrapper.findComponent(SprintFormDialog).props('mode')).toBe('edit')
    wrapper.unmount()
  })

  it('удаление показывает confirm с текстом sprintDeletionMessage и после подтверждения вызывает deleteSprint', async () => {
    const sprint = planned()
    const wrapper = await mountView([sprint], [
      rawTask({ id: 'a', sprintId: 'planned' }),
      rawTask({ id: 'b', sprintId: 'planned', completed: true }),
    ])
    const deleteSpy = vi.spyOn(useSprintStore(), 'deleteSprint').mockResolvedValue(undefined)
    const { options, handleConfirm } = useConfirm()

    wrapper.findAllComponents(SprintBlock)[0]!.vm.$emit('delete')
    await flushPromises()

    expect(options.value).toMatchObject({
      title: 'Удалить спринт?',
      message: sprintDeletionMessage(sprint, 2),
      variant: 'destructive',
    })
    expect(options.value?.message).toBe('Удалить „Спринт 2“? 2 задачи вернутся в бэклог.')
    expect(deleteSpy).not.toHaveBeenCalled()

    handleConfirm()
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('proj-1', 'planned')
    wrapper.unmount()
  })

  it('при отмене подтверждения deleteSprint не вызывается', async () => {
    const wrapper = await mountView([planned()])
    const deleteSpy = vi.spyOn(useSprintStore(), 'deleteSprint').mockResolvedValue(undefined)
    const { handleCancel } = useConfirm()

    wrapper.findAllComponents(SprintBlock)[0]!.vm.$emit('delete')
    await flushPromises()
    handleCancel()
    await flushPromises()

    expect(deleteSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

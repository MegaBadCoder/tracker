import type { BoardGroupNode, ProjectColumn, Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { api } from '@/api/client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import * as columnsApi from '@/features/projects/api/columns-api'
import * as groupsApi from '@/features/projects/api/groups-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import AgileBoardView from '@/features/projects/ui/AgileBoardView.vue'
import AgileEpicBlock from '@/features/projects/ui/AgileEpicBlock.vue'
import AgileStoryBlock from '@/features/projects/ui/AgileStoryBlock.vue'
import GroupActionsMenu from '@/features/projects/ui/GroupActionsMenu.vue'
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    sprintId: 'sprint-1',
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
    useSprintStore().lists['proj-1'] = [makeSprint()]

    return mount(AgileBoardView, {
      props: { projectId: 'proj-1' },
      global: {
        stubs: {
          AgileTaskCard: {
            name: 'AgileTaskCard',
            template: '<div class="task-card">{{ task.title }}</div>',
            props: ['task', 'variant', 'dndSource'],
          },
        },
      },
    })
  }

  it('возврат истории передаёт активный спринт и блокирует повтор до ответа', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1', sprintId: 'sprint-1' })
    const wrapper = setup([makeColumn()], [makeEpic({ children: [story] })], [])
    await flushPromises()
    let resolve!: (value: number) => void
    const remove = vi.spyOn(useSprintStore(), 'removeGroupFromSprint').mockImplementation(() => new Promise((done) => {
      resolve = done
    }))
    const menu = wrapper.findAllComponents(GroupActionsMenu).find(item => item.props('group').id === story.id)!
    expect(menu.props('canReturnToBacklog')).toBe(true)
    menu.vm.$emit('returnToBacklog')
    menu.vm.$emit('returnToBacklog')
    await wrapper.vm.$nextTick()
    expect(remove).toHaveBeenCalledExactlyOnceWith('proj-1', 'sprint-1', 'story-1')
    expect(menu.props('returningToBacklog')).toBe(true)
    expect(useGroupStore().groupsOf('proj-1')[0]!.children[0]!.sprintId).toBe('sprint-1')
    resolve(0)
    await flushPromises()
    expect(menu.props('returningToBacklog')).toBe(false)
    wrapper.unmount()
  })

  it('эпик доступен для возврата по скрытой выполненной задаче дочерней истории', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const wrapper = setup([makeColumn()], [makeEpic({ children: [story] })], [makeTask({ groupId: story.id, completed: true })])
    await wrapper.setProps({ showCompleted: false })
    await flushPromises()
    const remove = vi.spyOn(useSprintStore(), 'removeGroupFromSprint').mockResolvedValue(1)
    const menu = wrapper.findComponent(GroupActionsMenu)
    expect(menu.props('canReturnToBacklog')).toBe(true)
    menu.vm.$emit('returnToBacklog')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('proj-1', 'sprint-1', 'epic-1')
    wrapper.unmount()
  })

  it.each([
    { response: { data: { message: 'Спринт закрыт' } } },
    new Error('Изменения сохранены, но не удалось обновить данные: Сеть недоступна'),
  ])('показывает точную ошибку возврата без удаления структуры', async (error) => {
    const wrapper = setup([makeColumn()], [makeEpic()], [makeTask({ groupId: 'epic-1' })])
    await flushPromises()
    vi.spyOn(useSprintStore(), 'removeGroupFromSprint').mockRejectedValue(error)
    wrapper.findComponent(GroupActionsMenu).vm.$emit('returnToBacklog')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe(error instanceof Error ? error.message : error.response.data.message)
    expect(wrapper.findComponent(AgileEpicBlock).exists()).toBe(true)
    wrapper.unmount()
  })

  it('не предлагает возврат групп без назначений в активном спринте', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1', sprintId: 'other' })
    const wrapper = setup([makeColumn()], [makeEpic({ children: [story] })], [makeTask({ groupId: story.id, sprintId: 'other' })])
    await flushPromises()
    expect(wrapper.findAllComponents(GroupActionsMenu).every(menu => !menu.props('canReturnToBacklog'))).toBe(true)
    useSprintStore().lists['proj-1'] = []
    await wrapper.vm.$nextTick()
    expect(wrapper.findAllComponents(GroupActionsMenu).every(menu => !menu.props('canReturnToBacklog'))).toBe(true)
    wrapper.unmount()
  })

  it('показывает только группы спринта и сохраняет назначенные пустые истории', async () => {
    const assigned = makeEpic({ id: 'assigned', type: 'story', parentId: 'epic-1', sprintId: 'sprint-1' })
    const byTask = makeEpic({ id: 'by-task', type: 'story', parentId: 'epic-1', sprintId: 'other' })
    const backlog = makeEpic({ id: 'backlog', type: 'story', parentId: 'epic-1', sprintId: null })
    const wrapper = setup([makeColumn()], [makeEpic({ children: [assigned, byTask, backlog] }), makeEpic({ id: 'empty' }), makeEpic({ id: 'direct' })], [makeTask({ groupId: 'by-task', completed: true }), makeTask({ id: 'direct-task', groupId: 'direct' })])
    await wrapper.setProps({ showCompleted: false })
    await flushPromises()
    expect(wrapper.findAllComponents(AgileEpicBlock).map(c => c.props('epic').id)).toEqual(['epic-1', 'direct'])
    expect(wrapper.findAllComponents(AgileStoryBlock).map(c => c.props('story').id)).toEqual(['assigned', 'by-task'])
    wrapper.unmount()
  })

  it('после успешного возврата история и пустой эпик исчезают из доски, но остаются в дереве', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1', sprintId: 'sprint-1' })
    const wrapper = setup([makeColumn()], [makeEpic({ children: [story] })], [])
    await flushPromises()
    vi.spyOn(useSprintStore(), 'removeGroupFromSprint').mockImplementationOnce(async () => {
      useGroupStore().trees['proj-1'] = [makeEpic({ children: [{ ...story, sprintId: null }] })]
      return 0
    })
    wrapper.findAllComponents(GroupActionsMenu)[1]!.vm.$emit('returnToBacklog')
    await flushPromises()
    expect(wrapper.findAllComponents(AgileEpicBlock)).toHaveLength(0)
    expect(useGroupStore().groupsOf('proj-1')[0]!.children).toHaveLength(1)
    wrapper.unmount()
  })

  it.each([false, true])('создание истории назначает её в активный спринт, ошибка назначения видна (%s)', async (fail) => {
    const wrapper = setup([makeColumn()], [makeEpic()], [makeTask({ groupId: 'epic-1' })])
    await flushPromises()
    const story = makeEpic({ id: 'new-story', type: 'story', parentId: 'epic-1' })
    vi.mocked(groupsApi.createGroup).mockResolvedValueOnce({ data: story } as any)
    const assign = vi.spyOn(useSprintStore(), 'setStorySprint')
    if (fail)
      assign.mockRejectedValueOnce(new Error('Спринт закрыт'))
    else
      assign.mockResolvedValueOnce(0)
    wrapper.findComponent(AgileEpicBlock).vm.$emit('createStory', 'epic-1', 'История')
    await flushPromises()
    expect(assign).toHaveBeenCalledWith('proj-1', 'new-story', 'sprint-1')
    if (fail)
      expect(wrapper.get('[role="alert"]').text()).toContain('История создана. Спринт закрыт')
    wrapper.unmount()
  })

  it('не показывает на доске задачу истории/эпика с columnId === null — у ячейки доски всегда есть колонка', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', children: [story] })
    const wrapper = setup(
      [makeColumn()],
      [epic],
      [makeTask({ id: 't1', title: 'Задача без колонки', groupId: 'story-1', columnId: null })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Задача без колонки')
  })

  it('показывает только задачи активного спринта, а задачи другого спринта и бэклога — нет', async () => {
    const wrapper = setup(
      [makeColumn({ id: 'col-1' })],
      [],
      [
        makeTask({ id: 't1', title: 'Из активного', columnId: 'col-1', sprintId: 'sprint-1' }),
        makeTask({ id: 't2', title: 'Из другого спринта', columnId: 'col-1', sprintId: 'sprint-2' }),
        makeTask({ id: 't3', title: 'Из бэклога', columnId: 'col-1', sprintId: null }),
        makeTask({ id: 't4', title: 'Без поля спринта', columnId: 'col-1', sprintId: undefined }),
      ],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Из активного')
    expect(wrapper.text()).not.toContain('Из другого спринта')
    expect(wrapper.text()).not.toContain('Из бэклога')
    expect(wrapper.text()).not.toContain('Без поля спринта')
  })

  it('без активного спринта не показывает ни одной задачи', async () => {
    const wrapper = setup(
      [makeColumn({ id: 'col-1' })],
      [],
      [makeTask({ id: 't1', title: 'Задача', columnId: 'col-1', sprintId: 'sprint-1' })],
    )
    useSprintStore().lists['proj-1'] = [makeSprint({ status: 'closed' })]
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Задача')
  })

  it('рендерит ровно столько дорожек, сколько колонок у проекта', async () => {
    const wrapper = setup(
      [makeColumn({ id: 'col-1', title: 'В работе' }), makeColumn({ id: 'col-2', title: 'Готово', order: 1 })],
      [],
      [
        makeTask({ id: 't1', title: 'Задача с колонкой', columnId: 'col-1' }),
        makeTask({ id: 't2', title: 'Задача без колонки', columnId: null }),
      ],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const headers = wrapper.findAll('.sticky.top-0')
    expect(headers).toHaveLength(2)
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

  // Карточка умеет быть источником собственного PointerEvents-движка. Внутри
  // ячейки жестом владеет vuedraggable, и если движок оставить включённым, он
  // при старте делает setPointerCapture, забирает события себе — и Sortable
  // перетаскивания просто не видит. Снаружи это выглядит как «задачи не
  // переносятся между колонками», а тесты и типы при этом зелёные.
  it('карточки в ячейках не включают кастомный DnD-движок', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', children: [story] })
    const wrapper = setup(
      [makeColumn()],
      [epic],
      [makeTask({ id: 't1', groupId: 'story-1', columnId: 'col-1' })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAllComponents({ name: 'AgileTaskCard' })
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards)
      expect(card.props('task').id).toBe('t1')
  })
})

describe('agileBoardView — управление на доске', () => {
  const AgileTaskCardStub = {
    name: 'AgileTaskCard',
    template: '<div class="task-card">{{ task.title }}</div>',
    props: ['task', 'variant', 'dndSource'],
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useGroupDetail().close()
  })

  function setup(columns: ProjectColumn[], groups: BoardGroupNode[], tasks: Task[]) {
    vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: columns } as any)
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)

    const taskStore = useTaskStore()
    taskStore.tasks = tasks
    useSprintStore().lists['proj-1'] = [makeSprint()]

    return mount(AgileBoardView, {
      props: { projectId: 'proj-1' },
      global: { stubs: { AgileTaskCard: AgileTaskCardStub } },
    })
  }

  function setupWithConfirm(columns: ProjectColumn[], groups: BoardGroupNode[], tasks: Task[]) {
    vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: columns } as any)
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)

    const taskStore = useTaskStore()
    taskStore.tasks = tasks
    useSprintStore().lists['proj-1'] = [makeSprint()]

    const Harness = defineComponent({
      components: { AgileBoardView, ConfirmDialog },
      template: '<div><AgileBoardView project-id="proj-1" /><ConfirmDialog /></div>',
    })

    return mount(Harness, {
      attachTo: document.body,
      global: { stubs: { AgileTaskCard: AgileTaskCardStub } },
    })
  }

  function findButtonByText(wrapper: ReturnType<typeof setup>, text: string) {
    const button = wrapper.findAll('button').find(b => b.text() === text)
    if (!button)
      throw new Error(`Button with text "${text}" not found`)
    return button
  }

  function orderedGroups() {
    return [1, 2, 3, 4].map(n => makeEpic({
      id: `epic-${n}`,
      title: `Эпик ${n}`,
      order: n - 1,
      children: [1, 2].map(m => makeEpic({
        id: `story-${n}-${m}`,
        title: `История ${n}-${m}`,
        type: 'story',
        parentId: `epic-${n}`,
        sprintId: 'sprint-1',
        order: m - 1,
      })),
    }))
  }

  it('стрелки эпиков сохраняют полный порядок и сохраняют задачи и колонки', async () => {
    vi.mocked(groupsApi.reorderGroups).mockResolvedValue({} as any)
    const tasks = [makeTask({ groupId: 'story-1-1', columnId: 'col-1' })]
    const wrapper = setup([makeColumn()], orderedGroups(), tasks)
    await flushPromises()

    expect(wrapper.get('button[aria-label="Переместить эпик Эпик 1 выше"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Переместить эпик Эпик 4 ниже"]').attributes('disabled')).toBeDefined()
    for (const title of ['Эпик 3', 'Эпик 3', 'Эпик 4', 'Эпик 4']) {
      await wrapper.get(`button[aria-label="Переместить эпик ${title} выше"]`).trigger('click')
      await flushPromises()
    }

    expect(groupsApi.reorderGroups).toHaveBeenLastCalledWith('proj-1', ['epic-3', 'epic-4', 'epic-1', 'epic-2'])
    expect(wrapper.findAllComponents(AgileEpicBlock).map(c => c.props('epic').id)).toEqual(['epic-3', 'epic-4', 'epic-1', 'epic-2'])
    expect(useTaskStore().tasks).toEqual(tasks)
    expect(wrapper.findAll('.sticky.top-0')).toHaveLength(1)
  })

  it('стрелка переставляет видимых соседей через скрытые группы, сохраняя полный порядок', async () => {
    const groups = orderedGroups()
    groups[1]!.children.forEach(story => story.sprintId = null)
    vi.mocked(groupsApi.reorderGroups).mockResolvedValue({} as any)
    const wrapper = setup([makeColumn()], groups, [])
    await flushPromises()
    await wrapper.get('button[aria-label="Переместить эпик Эпик 1 ниже"]').trigger('click')
    await flushPromises()
    expect(groupsApi.reorderGroups).toHaveBeenCalledWith('proj-1', ['epic-3', 'epic-2', 'epic-1', 'epic-4'])
    expect(wrapper.findAllComponents(AgileEpicBlock).map(c => c.props('epic').id)).toEqual(['epic-3', 'epic-1', 'epic-4'])
    wrapper.unmount()
  })

  it('стрелки историй меняют порядок только внутри их эпика', async () => {
    vi.mocked(groupsApi.reorderGroups).mockResolvedValue({} as any)
    const wrapper = setup([makeColumn()], orderedGroups(), [])
    await flushPromises()

    expect(wrapper.get('button[aria-label="Переместить историю История 1-1 выше"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Переместить историю История 1-2 ниже"]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[aria-label="Переместить историю История 1-1 ниже"]').trigger('click')
    await flushPromises()

    expect(groupsApi.reorderGroups).toHaveBeenCalledWith('proj-1', ['story-1-2', 'story-1-1'])
    expect(wrapper.findAllComponents(AgileStoryBlock).map(c => c.props('story').id)).toEqual([
      'story-1-2',
      'story-1-1',
      'story-2-1',
      'story-2-2',
      'story-3-1',
      'story-3-2',
      'story-4-1',
      'story-4-2',
    ])
    expect(useGroupStore().groupsOf('proj-1')[0]?.children.every(story => story.parentId === 'epic-1')).toBe(true)
  })

  it('блокирует стрелки до ответа и при ошибке возвращает порядок с сообщением', async () => {
    let rejectSave!: (error: Error) => void
    vi.mocked(groupsApi.reorderGroups).mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectSave = reject
    }))
    const wrapper = setup([makeColumn()], orderedGroups(), [])
    await flushPromises()
    await wrapper.get('button[aria-label="Переместить эпик Эпик 1 ниже"]').trigger('click')

    expect(wrapper.findAllComponents(AgileEpicBlock)[0]?.props('epic').id).toBe('epic-2')
    expect(wrapper.findAll('button[aria-label^="Переместить"]').every(b => b.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.get('button[aria-label="Переместить эпик Эпик 1 ниже"]').trigger('click')
    expect(groupsApi.reorderGroups).toHaveBeenCalledTimes(1)

    rejectSave(new Error('offline'))
    await flushPromises()
    expect(wrapper.findAllComponents(AgileEpicBlock)[0]?.props('epic').id).toBe('epic-1')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить порядок')
    expect(wrapper.get('button[aria-label="Переместить эпик Эпик 1 ниже"]').attributes('disabled')).toBeUndefined()
  })

  it('«+ Эпик» создаёт новый эпик', async () => {
    vi.mocked(groupsApi.createGroup).mockResolvedValueOnce({
      data: makeEpic({ id: 'epic-new', title: 'Новый эпик' }),
    } as any)
    const wrapper = setup([makeColumn()], [], [])
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await findButtonByText(wrapper, 'Эпик').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('Новый эпик')
    await input.trigger('keydown.enter')
    await wrapper.vm.$nextTick()

    expect(groupsApi.createGroup).toHaveBeenCalledWith('proj-1', { title: 'Новый эпик' })
    await flushPromises()
    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-new' })
    expect(wrapper.get('[role="status"]').text()).toContain('Эпик создан в бэклоге')
    expect(wrapper.findComponent(AgileEpicBlock).exists()).toBe(false)
  })

  it('«+» у эпика создаёт задачу с groupId эпика и первой колонкой доски', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 'task-new', title: 'Новая задача', completed: false, projectId: 'proj-1', columnId: 'col-1', groupId: 'epic-1' },
    } as any)
    const epic = makeEpic({ id: 'epic-1' })
    const wrapper = setup(
      [makeColumn({ id: 'col-1' }), makeColumn({ id: 'col-2', order: 1 })],
      [epic],
      [makeTask({ groupId: epic.id })],
    )
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await wrapper.find('button[aria-label="Добавить задачу в эпик"]').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('Новая задача')
    await input.trigger('keydown.enter')
    await wrapper.vm.$nextTick()

    expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      title: 'Новая задача',
      projectId: 'proj-1',
      columnId: 'col-1',
      groupId: 'epic-1',
      sprintId: 'sprint-1',
    }))
  })

  it('esc в поле создания задачи эпика не создаёт задачу', async () => {
    const epic = makeEpic({ id: 'epic-1' })
    const wrapper = setup([makeColumn()], [epic], [makeTask({ groupId: epic.id })])
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await wrapper.find('button[aria-label="Добавить задачу в эпик"]').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('Что-то')
    await input.trigger('keydown.escape')
    await wrapper.vm.$nextTick()

    expect(api.post).not.toHaveBeenCalled()
  })

  it('клик по названию эпика открывает карточку группы через useGroupDetail', async () => {
    const epic = makeEpic({ id: 'epic-1' })
    const wrapper = setup([makeColumn()], [epic], [makeTask({ groupId: epic.id })])
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await findButtonByText(wrapper, 'Эпик').trigger('click')

    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-1' })
  })

  it('удаление эпика показывает confirm с числом историй и задач и после подтверждения не удаляет задачи из стора', async () => {
    const story1 = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const story2 = makeEpic({ id: 'story-2', type: 'story', parentId: 'epic-1' })
    const epic = makeEpic({ id: 'epic-1', title: 'Эпик', children: [story1, story2] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'epic-1', columnId: 'col-1' }),
      makeTask({ id: 't2', groupId: 'story-1', columnId: 'col-1' }),
      makeTask({ id: 't3', groupId: 'story-1', columnId: 'col-1' }),
      makeTask({ id: 't4', groupId: 'story-2', columnId: 'col-1' }),
      makeTask({ id: 't5', groupId: 'story-2', columnId: 'col-1' }),
    ]
    vi.mocked(groupsApi.deleteGroup).mockResolvedValueOnce({} as any)
    const wrapper = setupWithConfirm([makeColumn()], [epic], tasks)
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await wrapper.find('button[aria-label="Действия с эпиком"]').trigger('click')
    await wrapper.vm.$nextTick()
    const deleteItem = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .find(el => el.textContent?.trim() === 'Удалить')!
    await deleteItem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()

    const description = document.querySelector('[data-slot="alert-dialog-description"]')
    expect(description?.textContent).toBe(
      'Удалить эпик „Эпик“? Вместе с ним удалятся 2 истории. 5 задач останутся и переедут в „Без эпика“.',
    )

    const confirmButton = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Удалить' && !b.closest('[data-slot="dropdown-menu-content"]'))!
    confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(groupsApi.deleteGroup).toHaveBeenCalledWith('proj-1', 'epic-1')
    const taskStore = useTaskStore()
    expect(taskStore.tasks).toHaveLength(5)
    expect(taskStore.tasks.every(t => t.groupId === null)).toBe(true)

    wrapper.unmount()
  })

  it('отмена confirm ничего не удаляет', async () => {
    const epic = makeEpic({ id: 'epic-1', title: 'Эпик' })
    const tasks = [makeTask({ id: 't1', groupId: 'epic-1', columnId: 'col-1' })]
    const wrapper = setupWithConfirm([makeColumn()], [epic], tasks)
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await wrapper.find('button[aria-label="Действия с эпиком"]').trigger('click')
    await wrapper.vm.$nextTick()
    const deleteItem = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .find(el => el.textContent?.trim() === 'Удалить')!
    await deleteItem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()

    const cancelButton = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Отмена')!
    cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()

    expect(groupsApi.deleteGroup).not.toHaveBeenCalled()
    const taskStore = useTaskStore()
    expect(taskStore.tasks[0]?.groupId).toBe('epic-1')

    wrapper.unmount()
  })
})

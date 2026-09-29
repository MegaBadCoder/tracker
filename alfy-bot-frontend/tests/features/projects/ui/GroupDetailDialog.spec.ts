import type { BoardGroupNode, Project } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { Calendar } from '@/components/ui/calendar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { intlLocale } from '@/composables/useLocale'
import * as groupsApi from '@/features/projects/api/groups-api'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import GroupDetailDialog from '@/features/projects/ui/GroupDetailDialog.vue'
import * as taskDetailNavigation from '@/features/tasks/lib/task-detail-navigation'
import { useTaskStore } from '@/features/tasks/model/task-store'

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

vi.mock('@/features/tasks/lib/task-detail-navigation', () => ({
  openTaskDetail: vi.fn(),
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'board',
    type: 'agile',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
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
    startDate: null,
    dueDate: null,
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

// Dialog/Popover/DropdownMenu — real reka-ui-порталы: их содержимое телепортируется
// в document.body мимо wrapper.element, поэтому проверки идут через document,
// а не через wrapper.find()/wrapper.text() (кроме findComponent — он смотрит
// на дерево компонентов, а не на DOM, и телепорт ему не мешает).
function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim().includes(text))
  if (!button)
    throw new Error(`Button with text "${text}" not found`)
  return button as HTMLButtonElement
}

async function clickEl(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
  await nextTick()
}

function setup(project: Project, groups: BoardGroupNode[], tasks: Task[]) {
  useProjectStore().projects = [project]
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)
  useTaskStore().tasks = tasks

  return mount(GroupDetailDialog, {
    attachTo: document.body,
  })
}

function setupWithConfirm(project: Project, groups: BoardGroupNode[], tasks: Task[]) {
  useProjectStore().projects = [project]
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)
  useTaskStore().tasks = tasks

  const Harness = defineComponent({
    components: { GroupDetailDialog, ConfirmDialog },
    template: '<div><GroupDetailDialog /><ConfirmDialog /></div>',
  })

  return mount(Harness, {
    attachTo: document.body,
  })
}

describe('groupDetailDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useGroupDetail().close()
  })

  it('открывается по useGroupDetail().open, показывает название и прогресс эпика (n из m)', async () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1' })
    const wrapper = setup(makeProject(), [epic], [
      makeTask({ id: 't1', groupId: 'epic-1', completed: true }),
      makeTask({ id: 't2', groupId: 'epic-1', completed: false }),
    ])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Эпик 1')
    expect(document.body.textContent).toContain('1 из 2 готово')

    wrapper.unmount()
  })

  it('клик по истории переключает карточку на историю (крошки показывают эпик); клик по эпику в крошках возвращает', async () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История 1' })
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1', children: [story] })
    const wrapper = setup(makeProject(), [epic], [])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    await clickEl(findButtonByText('История 1'))

    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'story-1' })
    const crumbButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Эпик 1')
    expect(crumbButton).toBeTruthy()

    await clickEl(crumbButton!)

    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-1' })
    expect(Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('История 1'))).toBe(true)

    wrapper.unmount()
  })

  it('клик по задаче закрывает карточку и вызывает openTaskDetail с задачей', async () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1' })
    const task = makeTask({ id: 't1', title: 'Моя задача', groupId: 'epic-1' })
    const wrapper = setup(makeProject(), [epic], [task])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    await clickEl(findButtonByText('Моя задача'))

    expect(useGroupDetail().current.value).toBeNull()
    expect(taskDetailNavigation.openTaskDetail).toHaveBeenCalledWith(task)

    wrapper.unmount()
  })

  it('у истории нет дат и цвета; у эпика есть', async () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История 1' })
    const epic = makeGroup({
      id: 'epic-1',
      title: 'Эпик 1',
      children: [story],
      startDate: '2026-01-01',
      dueDate: '2026-02-01',
    })
    const wrapper = setup(makeProject(), [epic], [])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()
    expect(document.body.textContent).toContain('Цвет')
    expect(document.body.textContent).toContain('Начало')
    expect(document.body.textContent).toContain('Срок')

    useGroupDetail().open('proj-1', 'story-1')
    await flushPromises()
    await nextTick()
    expect(document.body.textContent).not.toContain('Цвет')
    expect(document.body.textContent).not.toContain('Начало')
    expect(document.body.textContent).not.toContain('Срок')

    wrapper.unmount()
  })

  it('календарь получает locale (проверить проп на компоненте Calendar)', async () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1' })
    const wrapper = setup(makeProject(), [epic], [])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    await clickEl(findButtonByText('Начало'))

    const calendar = wrapper.findComponent(Calendar)
    expect(calendar.exists()).toBe(true)
    expect(calendar.props('locale')).toBe(intlLocale.value)

    wrapper.unmount()
  })

  it('изменение названия на blur вызывает updateGroup один раз; без изменения — не вызывает', async () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1' })
    vi.mocked(groupsApi.updateGroup).mockResolvedValueOnce({ data: { ...epic, title: 'Новое название' } } as any)
    const wrapper = setup(makeProject(), [epic], [])

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    const titleEl = document.querySelector('[aria-label="Название группы"]') as HTMLElement
    expect(titleEl).toBeTruthy()
    titleEl.textContent = 'Новое название'
    titleEl.dispatchEvent(new Event('input', { bubbles: true }))
    titleEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await flushPromises()

    expect(groupsApi.updateGroup).toHaveBeenCalledTimes(1)
    expect(groupsApi.updateGroup).toHaveBeenCalledWith('proj-1', 'epic-1', { title: 'Новое название' })

    titleEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await flushPromises()
    expect(groupsApi.updateGroup).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('удаление показывает тот же текст подтверждения, что и доска, и закрывает карточку; задачи остаются с groupId = null', async () => {
    const story1 = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const story2 = makeGroup({ id: 'story-2', type: 'story', parentId: 'epic-1' })
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик', children: [story1, story2] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'epic-1' }),
      makeTask({ id: 't2', groupId: 'story-1' }),
      makeTask({ id: 't3', groupId: 'story-1' }),
      makeTask({ id: 't4', groupId: 'story-2' }),
      makeTask({ id: 't5', groupId: 'story-2' }),
    ]
    vi.mocked(groupsApi.deleteGroup).mockResolvedValueOnce({} as any)
    const wrapper = setupWithConfirm(makeProject(), [epic], tasks)

    useGroupDetail().open('proj-1', 'epic-1')
    await flushPromises()
    await nextTick()

    await clickEl(document.querySelector('button[aria-label="Действия с группой"]')!)
    const deleteItem = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .find(el => el.textContent?.trim() === 'Удалить')!
    await clickEl(deleteItem)

    const description = document.querySelector('[data-slot="alert-dialog-description"]')
    expect(description?.textContent).toBe(
      'Удалить эпик „Эпик“? Вместе с ним удалятся 2 истории. 5 задач останутся и переедут в „Без эпика“.',
    )

    const confirmButton = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Удалить' && !b.closest('[data-slot="dropdown-menu-content"]'))!
    await clickEl(confirmButton)

    expect(groupsApi.deleteGroup).toHaveBeenCalledWith('proj-1', 'epic-1')
    const taskStore = useTaskStore()
    expect(taskStore.tasks).toHaveLength(5)
    expect(taskStore.tasks.every(t => t.groupId === null)).toBe(true)
    expect(useGroupDetail().current.value).toBeNull()

    wrapper.unmount()
  })

  it('группа, которой нет в дереве после загрузки, закрывает карточку', async () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик 1' })
    const wrapper = setup(makeProject(), [epic], [])

    useGroupDetail().open('proj-1', 'missing-id')
    await flushPromises()
    await nextTick()

    expect(useGroupDetail().current.value).toBeNull()

    wrapper.unmount()
  })
})

import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as groupsApi from '@/features/projects/api/groups-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import BacklogEpicsPanel from '@/features/projects/ui/BacklogEpicsPanel.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/groups-api', () => ({
  fetchGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

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
    sprintId: null,
    columnId: null,
    groupId: null,
    order: 0,
    ...overrides,
  } as Task
}

describe('backlogEpicsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useGroupDetail().close()
  })

  function setup() {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    useGroupStore().trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Платежи', children: [story] })]
    useTaskStore().tasks = [
      makeTask({ id: 'a', groupId: 'epic-1', completed: true }),
      makeTask({ id: 'b', groupId: 'story-1', completed: true }),
      makeTask({ id: 'c', groupId: 'story-1', completed: false }),
      makeTask({ id: 'd', groupId: null }),
    ]
    return mount(BacklogEpicsPanel, { props: { projectId: 'proj-1' }, attachTo: document.body })
  }

  it('показывает эпик с историей и счётчиками выполнено/всего', () => {
    const wrapper = setup()

    const epicRow = wrapper.get('[data-group-id="epic-1"]')
    const storyRow = wrapper.get('[data-group-id="story-1"]')
    expect(epicRow.text()).toContain('Платежи')
    expect(epicRow.get('[data-testid="group-counter"]').text()).toBe('2/3')
    expect(storyRow.text()).toContain('История')
    expect(storyRow.get('[data-testid="group-counter"]').text()).toBe('1/2')
    wrapper.unmount()
  })

  it('«+ Эпик» создаёт эпик с введённым названием', async () => {
    vi.mocked(groupsApi.createGroup).mockResolvedValue({ data: makeGroup({ id: 'epic-2', title: 'Новый' }) } as any)
    const wrapper = setup()

    const add = wrapper.findAll('button').find(b => b.text() === 'Эпик')
    await add!.trigger('click')
    const input = wrapper.find('input')
    await input.setValue('Новый')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(groupsApi.createGroup).toHaveBeenCalledWith('proj-1', { title: 'Новый' })
    wrapper.unmount()
  })

  it('клик по названию открывает карточку группы через useGroupDetail', async () => {
    const wrapper = setup()

    await wrapper.get('[data-group-id="epic-1"] button.truncate').trigger('click')
    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-1' })

    await wrapper.get('[data-group-id="story-1"] button.truncate').trigger('click')
    expect(useGroupDetail().current.value).toEqual({ projectId: 'proj-1', groupId: 'story-1' })
    wrapper.unmount()
  })

  it('кнопка-заголовок «Эпики» переключает раскрытие на мобильном', async () => {
    const wrapper = setup()
    const toggle = wrapper.get('button[aria-expanded]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })
})

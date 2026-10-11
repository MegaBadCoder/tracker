import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import draggable from 'vuedraggable'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import SprintBlock from '@/features/projects/ui/SprintBlock.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: null,
    startDate: '2026-10-05',
    endDate: '2026-10-18',
    status: 'planned',
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

interface Props {
  sprint: Sprint | null
  tasks?: Task[]
  canStart?: boolean
  canManage?: boolean
  hasActiveSprint?: boolean
}

function mountBlock(props: Props) {
  return mount(SprintBlock, {
    props: { projectId: 'proj-1', tasks: [], ...props },
    attachTo: document.body,
  })
}

function buttonByText(wrapper: ReturnType<typeof mountBlock>, text: string) {
  return wrapper.findAll('button').find(b => b.text().includes(text))
}

describe('sprintBlock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('показывает историю с задачами и сохраняет общий счётчик спринта', async () => {
    const story = { id: 'story-1', projectId: 'proj-1', parentId: 'epic-1', type: 'story', title: 'Оплата', status: 'open', order: 0, releaseId: null, children: [] }
    useGroupStore().trees['proj-1'] = [{ id: 'epic-1', title: 'Платежи', type: 'epic', children: [story] } as any]
    const task = makeTask({ groupId: 'story-1', title: 'Форма оплаты' })
    useTaskStore().tasks = [task, makeTask({ id: 'hidden', completed: true })]
    const wrapper = mountBlock({ sprint: makeSprint(), tasks: [task] })
    const row = wrapper.get('[data-story-id="story-1"]')
    expect(row.text()).toContain('Оплата')
    expect(wrapper.get('[data-testid="sprint-counter"]').text()).toBe('1 из 2 готово')
    await row.get('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-task-id="task-1"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('показывает пустую историю в бэклоге, но не в спринте', () => {
    useGroupStore().trees['proj-1'] = [{ id: 'epic-1', title: 'Эпик', children: [{ id: 'empty', projectId: 'proj-1', parentId: 'epic-1', type: 'story', title: 'Пустая история', status: 'open', order: 0, children: [] }] } as any]
    const backlog = mountBlock({ sprint: null })
    expect(backlog.find('[data-story-id="empty"]').exists()).toBe(true)
    backlog.unmount()
    const sprint = mountBlock({ sprint: makeSprint() })
    expect(sprint.find('[data-story-id="empty"]').exists()).toBe(false)
    sprint.unmount()
  })

  it('показывает в бэклоге историю, у которой остались только задачи закрытого спринта', () => {
    useSprintStore().lists['proj-1'] = [makeSprint({ id: 'closed', status: 'closed' })]
    useGroupStore().trees['proj-1'] = [{ id: 'epic', children: [{ id: 'story', projectId: 'proj-1', parentId: 'epic', type: 'story', title: 'История', status: 'open', sprintId: null, children: [] }] } as any]
    useTaskStore().tasks = [makeTask({ groupId: 'story', sprintId: 'closed', completed: true })]
    const backlog = mountBlock({ sprint: null })
    expect(backlog.find('[data-story-id="story"]').exists()).toBe(true)
    backlog.unmount()
  })

  it('«+ задача» в блоке спринта эмитит createTask с названием', async () => {
    const wrapper = mountBlock({ sprint: makeSprint() })

    await buttonByText(wrapper, 'задача')!.trigger('click')
    const input = wrapper.find('input')
    await input.setValue('Новая')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('createTask')).toEqual([['Новая']])
    wrapper.unmount()
  })

  it('«+ задача» в бэклоге тоже эмитит createTask', async () => {
    const wrapper = mountBlock({ sprint: null })

    await buttonByText(wrapper, 'задача')!.trigger('click')
    const input = wrapper.find('input')
    await input.setValue('В бэклог')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('createTask')).toEqual([['В бэклог']])
    wrapper.unmount()
  })

  it('«Начать спринт» не рендерится без canStart', () => {
    const wrapper = mountBlock({ sprint: makeSprint({ status: 'planned' }) })

    expect(buttonByText(wrapper, 'Начать спринт')).toBeUndefined()
    wrapper.unmount()
  })

  it('«Начать спринт» рендерится при canStart только у planned без активного спринта', async () => {
    const planned = mountBlock({ sprint: makeSprint({ status: 'planned' }), canStart: true })
    expect(buttonByText(planned, 'Начать спринт')).toBeDefined()
    await buttonByText(planned, 'Начать спринт')!.trigger('click')
    expect(planned.emitted('start')).toHaveLength(1)
    planned.unmount()

    const withActive = mountBlock({ sprint: makeSprint({ status: 'planned' }), canStart: true, hasActiveSprint: true })
    expect(buttonByText(withActive, 'Начать спринт')).toBeUndefined()
    withActive.unmount()

    const active = mountBlock({ sprint: makeSprint({ status: 'active' }), canStart: true })
    expect(buttonByText(active, 'Начать спринт')).toBeUndefined()
    active.unmount()

    const backlog = mountBlock({ sprint: null, canStart: true })
    expect(buttonByText(backlog, 'Начать спринт')).toBeUndefined()
    backlog.unmount()
  })

  it('«Завершить» рендерится только у active при canManage', async () => {
    const withoutManage = mountBlock({ sprint: makeSprint({ status: 'active' }) })
    expect(buttonByText(withoutManage, 'Завершить')).toBeUndefined()
    withoutManage.unmount()

    const active = mountBlock({ sprint: makeSprint({ status: 'active' }), canManage: true })
    expect(buttonByText(active, 'Завершить')).toBeDefined()
    await buttonByText(active, 'Завершить')!.trigger('click')
    expect(active.emitted('complete')).toHaveLength(1)
    active.unmount()

    const planned = mountBlock({ sprint: makeSprint({ status: 'planned' }), canManage: true })
    expect(buttonByText(planned, 'Завершить')).toBeUndefined()
    planned.unmount()
  })

  it('меню «⋯» со спринтом только у planned при canManage и эмитит edit/delete', async () => {
    const withoutManage = mountBlock({ sprint: makeSprint() })
    expect(withoutManage.find('button[aria-label="Действия со спринтом"]').exists()).toBe(false)
    withoutManage.unmount()

    const active = mountBlock({ sprint: makeSprint({ status: 'active' }), canManage: true })
    expect(active.find('button[aria-label="Действия со спринтом"]').exists()).toBe(false)
    active.unmount()

    const planned = mountBlock({ sprint: makeSprint(), canManage: true })
    await planned.find('button[aria-label="Действия со спринтом"]').trigger('click')
    await planned.vm.$nextTick()
    const items = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    const pick = async (label: string) => {
      items.find(el => el.textContent?.trim() === label)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await planned.vm.$nextTick()
    }
    expect(items.map(el => el.textContent?.trim())).toEqual(['Изменить', 'Удалить'])
    await pick('Изменить')
    expect(planned.emitted('edit')).toHaveLength(1)
    planned.unmount()
  })

  it('change с added эмитит moveTask с id блока-спринта и null для бэклога', () => {
    const task = makeTask({ id: 'moved' })

    const sprintBlock = mountBlock({ sprint: makeSprint({ id: 'sprint-7' }) })
    sprintBlock.findAllComponents(draggable).find(list => (list.vm.$attrs.group as { name: string }).name === 'sprint-backlog')!.vm.$emit('change', { added: { element: task, newIndex: 0 } })
    expect(sprintBlock.emitted('moveTask')).toEqual([['moved', 'sprint-7']])
    sprintBlock.unmount()

    const backlog = mountBlock({ sprint: null })
    backlog.findAllComponents(draggable).find(list => (list.vm.$attrs.group as { name: string }).name === 'sprint-backlog')!.vm.$emit('change', { added: { element: task, newIndex: 0 } })
    expect(backlog.emitted('moveTask')).toEqual([['moved', null]])
    backlog.unmount()
  })

  it('истории перетаскиваются отдельной группой за ручку', () => {
    const wrapper = mountBlock({ sprint: makeSprint() })
    const lists = wrapper.findAllComponents(draggable)
    const storyList = lists.find(list => (list.vm.$attrs.group as { name: string }).name === 'sprint-stories')!
    expect(storyList.vm.$attrs.handle).toBe('.story-drag-handle')
    expect(wrapper.text()).toContain('Перетащите историю сюда')
    storyList.vm.$emit('change', { added: { element: { story: { id: 'story-7' } } } })
    expect(wrapper.emitted('moveStory')).toEqual([['story-7', 'sprint-1']])
    expect(wrapper.emitted('moveTask')).toBeUndefined()
    wrapper.unmount()
  })

  it('change без added (moved) не эмитит moveTask', () => {
    const wrapper = mountBlock({ sprint: makeSprint() })
    wrapper.findAllComponents(draggable).find(list => (list.vm.$attrs.group as { name: string }).name === 'sprint-backlog')!.vm.$emit('change', { moved: { element: makeTask(), newIndex: 1, oldIndex: 0 } })

    expect(wrapper.emitted('moveTask')).toBeUndefined()
    wrapper.unmount()
  })

  it('список настроен как sprint-backlog без сортировки', () => {
    const wrapper = mountBlock({ sprint: makeSprint() })
    const list = wrapper.findAllComponents(draggable).find(list => (list.vm.$attrs.group as { name: string }).name === 'sprint-backlog')!

    expect(list.vm.$attrs.group).toEqual({ name: 'sprint-backlog' })
    expect(list.vm.$attrs.sort).toBe(false)
    wrapper.unmount()
  })

  it('шапка спринта: название, даты «5 окт. – 18 окт.» и счётчик «n из m готово»', () => {
    const taskStore = useTaskStore()
    taskStore.tasks = [
      makeTask({ id: 'a', completed: true }),
      makeTask({ id: 'b', completed: false }),
      makeTask({ id: 'c', sprintId: 'other', completed: true }),
    ]
    const wrapper = mountBlock({ sprint: makeSprint({ name: 'Осень', goal: 'Релиз' }) })

    expect(wrapper.text()).toContain('Осень')
    expect(wrapper.text()).toContain('5 окт. – 18 окт.')
    expect(wrapper.text()).toContain('Релиз')
    expect(wrapper.get('[data-testid="sprint-counter"]').text()).toBe('1 из 2 готово')
    wrapper.unmount()
  })

  it('без дат спринта даты не показываются', () => {
    const wrapper = mountBlock({ sprint: makeSprint({ startDate: null, endDate: null }) })

    expect(wrapper.text()).not.toContain('–')
    wrapper.unmount()
  })

  it('бэклог: заголовок «Бэклог» и счётчик — только число задач проекта без спринта', () => {
    useTaskStore().tasks = [
      makeTask({ id: 'a', sprintId: null }),
      makeTask({ id: 'b', sprintId: undefined }),
      makeTask({ id: 'c', sprintId: 'sprint-1' }),
      makeTask({ id: 'd', sprintId: null, projectId: 'proj-2' }),
    ]
    const wrapper = mountBlock({ sprint: null })

    expect(wrapper.text()).toContain('Бэклог')
    expect(wrapper.get('[data-testid="sprint-counter"]').text()).toBe('2')
    wrapper.unmount()
  })

  it('рисует переданные задачи строками', () => {
    useSprintStore().lists['proj-1'] = [makeSprint()]
    const wrapper = mountBlock({
      sprint: makeSprint(),
      tasks: [makeTask({ id: 'a', title: 'Первая' }), makeTask({ id: 'b', title: 'Вторая' })],
    })

    expect(wrapper.findAll('[data-task-id]').map(r => r.text())).toEqual([
      expect.stringContaining('Первая'),
      expect.stringContaining('Вторая'),
    ])
    wrapper.unmount()
  })
})

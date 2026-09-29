import type { BoardGroupNode, ProjectColumn, Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useGroupStore } from '@/features/projects/model/group-store'
import BacklogTaskRow from '@/features/projects/ui/BacklogTaskRow.vue'

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
    color: '#ff0000',
    startDate: null,
    dueDate: null,
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
    startDate: null,
    endDate: null,
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
    sprintId: null,
    columnId: null,
    groupId: null,
    order: 0,
    ...overrides,
  } as Task
}

function mountRow(task: Task, sprints: Sprint[] = []) {
  return mount(BacklogTaskRow, { props: { task, sprints }, attachTo: document.body })
}

async function openSprintSubmenu(wrapper: ReturnType<typeof mountRow>) {
  await wrapper.find('button[aria-label="Действия с задачей"]').trigger('click')
  await wrapper.vm.$nextTick()
  const trigger = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]'))
    .find(el => el.textContent?.includes('В спринт'))
  trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
}

function checkboxItems() {
  return Array.from(document.querySelectorAll('[data-slot="dropdown-menu-checkbox-item"]'))
}

describe('backlogTaskRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
  })

  it('показывает метку эпика с цветной точкой', () => {
    useGroupStore().trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Платежи', color: '#ff0000' })]
    const wrapper = mountRow(makeTask({ groupId: 'epic-1' }))

    const label = wrapper.get('[data-testid="epic-label"]')
    expect(label.text()).toContain('Платежи')
    expect(label.find('span[style]').attributes('style')).toContain('background-color')
    wrapper.unmount()
  })

  it('для задачи в истории показывает «эпик › история»', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'Оплата картой', color: null })
    useGroupStore().trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Платежи', children: [story] })]
    const wrapper = mountRow(makeTask({ groupId: 'story-1' }))

    const text = wrapper.get('[data-testid="epic-label"]').text()
    expect(text).toContain('Платежи')
    expect(text).toContain('›')
    expect(text).toContain('Оплата картой')
    wrapper.unmount()
  })

  it('без группы метка эпика не рисуется', () => {
    const wrapper = mountRow(makeTask({ groupId: null }))

    expect(wrapper.find('[data-testid="epic-label"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('колонка показывается бейджем, а при columnId = null бейджа нет', () => {
    useColumnStore().columns = [{ id: 'col-1', projectId: 'proj-1', title: 'В работе', order: 0, color: null } as ProjectColumn]

    const withColumn = mountRow(makeTask({ columnId: 'col-1' }))
    expect(withColumn.get('[data-testid="column-badge"]').text()).toBe('В работе')
    withColumn.unmount()

    const withoutColumn = mountRow(makeTask({ columnId: null }))
    expect(withoutColumn.find('[data-testid="column-badge"]').exists()).toBe(false)
    withoutColumn.unmount()
  })

  it('клик по строке эмитит open, а отметка выполнения — toggle без open', async () => {
    const task = makeTask({ id: 'task-9' })
    const wrapper = mountRow(task)

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('toggle')).toEqual([['task-9']])
    expect(wrapper.emitted('open')).toBeUndefined()

    await wrapper.trigger('click')
    expect(wrapper.emitted('open')).toEqual([[task]])
    wrapper.unmount()
  })

  it('подменю «В спринт…» содержит бэклог, активный и запланированные; текущий отмечен и недоступен', async () => {
    const sprints = [
      makeSprint({ id: 'active', name: 'Активный', status: 'active' }),
      makeSprint({ id: 'planned', name: 'Запланированный', status: 'planned', order: 1 }),
    ]
    const wrapper = mountRow(makeTask({ sprintId: 'active' }), sprints)
    await openSprintSubmenu(wrapper)

    const items = checkboxItems()
    expect(items.map(el => el.textContent?.trim())).toEqual(['Бэклог', 'Активный', 'Запланированный'])
    const current = items[1]!
    expect(current.getAttribute('data-state')).toBe('checked')
    expect(current.hasAttribute('data-disabled')).toBe(true)
    expect(items[0]!.getAttribute('data-state')).toBe('unchecked')
    wrapper.unmount()
  })

  it('для задачи без спринта текущим отмечен «Бэклог»', async () => {
    const wrapper = mountRow(makeTask({ sprintId: null }), [makeSprint({ id: 'planned', name: 'Запланированный' })])
    await openSprintSubmenu(wrapper)

    const items = checkboxItems()
    expect(items[0]!.getAttribute('data-state')).toBe('checked')
    expect(items[0]!.hasAttribute('data-disabled')).toBe(true)
    expect(items[1]!.getAttribute('data-state')).toBe('unchecked')
    wrapper.unmount()
  })

  it('выбор спринта эмитит move с его id, выбор бэклога — с null', async () => {
    const wrapper = mountRow(makeTask({ sprintId: 'planned' }), [makeSprint({ id: 'planned', name: 'Запланированный' }), makeSprint({ id: 'other', name: 'Другой', order: 1 })])
    await openSprintSubmenu(wrapper)

    const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    click(checkboxItems().find(el => el.textContent?.trim() === 'Другой')!)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('move')).toEqual([['other']])
    wrapper.unmount()

    const second = mountRow(makeTask({ sprintId: 'planned' }), [makeSprint({ id: 'planned', name: 'Запланированный' })])
    await openSprintSubmenu(second)
    click(checkboxItems().find(el => el.textContent?.trim() === 'Бэклог')!)
    await second.vm.$nextTick()
    expect(second.emitted('move')).toEqual([[null]])
    second.unmount()
  })
})

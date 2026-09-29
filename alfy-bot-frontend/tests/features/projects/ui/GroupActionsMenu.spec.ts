import type { BoardGroup } from '@/features/projects/model/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GroupActionsMenu from '@/features/projects/ui/GroupActionsMenu.vue'

function makeGroup(overrides: Partial<BoardGroup> = {}): BoardGroup {
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
    ...overrides,
  }
}

async function openMenu(group: BoardGroup) {
  const wrapper = mount(GroupActionsMenu, {
    props: { group },
    attachTo: document.body,
  })
  await wrapper.find('button').trigger('click')
  await wrapper.vm.$nextTick()
  return wrapper
}

function itemLabels(): string[] {
  return Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    .map(el => el.textContent?.trim() ?? '')
}

describe('groupActionsMenu', () => {
  it('у истории нет пунктов «Цвет» и «Добавить историю»', async () => {
    const wrapper = await openMenu(makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' }))

    expect(document.body.textContent).not.toContain('Цвет')
    expect(document.body.textContent).not.toContain('Добавить историю')

    wrapper.unmount()
  })

  it('у эпика есть пункты «Цвет» и «Добавить историю»', async () => {
    const wrapper = await openMenu(makeGroup({ type: 'epic' }))

    expect(document.body.textContent).toContain('Цвет')
    expect(document.body.textContent).toContain('Добавить историю')

    wrapper.unmount()
  })

  it('пункт переключения статуса — «Закрыть» для открытой группы', async () => {
    const wrapper = await openMenu(makeGroup({ status: 'open' }))

    expect(itemLabels()).toContain('Закрыть')
    expect(itemLabels()).not.toContain('Открыть')

    wrapper.unmount()
  })

  it('пункт переключения статуса — «Открыть» для закрытой группы', async () => {
    const wrapper = await openMenu(makeGroup({ status: 'done' }))

    expect(itemLabels()).toContain('Открыть')
    expect(itemLabels()).not.toContain('Закрыть')

    wrapper.unmount()
  })
})

import type { AgileStoryRow } from '@/features/projects/lib/agile-layout'
import type { BoardGroupNode, ProjectColumn } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgileEpicBlock from '@/features/projects/ui/AgileEpicBlock.vue'

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
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

function mountBlock(epic: BoardGroupNode, stories: AgileStoryRow[] = [], epicTasks: Task[] = []) {
  return mount(AgileEpicBlock, {
    props: { epic, stories, epicTasks, lanes: [makeColumn()] },
    attachTo: document.body,
    global: {
      stubs: {
        TaskCard: { name: 'TaskCard', template: '<div />', props: ['task', 'variant', 'dndSource'] },
      },
    },
  })
}

async function openMenuItem(wrapper: ReturnType<typeof mountBlock>, label: string) {
  await wrapper.find('button[aria-label="Действия с эпиком"]').trigger('click')
  await wrapper.vm.$nextTick()
  const item = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    .find(el => el.textContent?.trim() === label)
  await item?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await wrapper.vm.$nextTick()
}

describe('agileEpicBlock', () => {
  it('клик по названию эпика испускает openGroup', async () => {
    const wrapper = mountBlock(makeEpic())
    await wrapper.find('button.font-semibold').trigger('click')

    expect(wrapper.emitted('openGroup')).toEqual([['epic-1']])
    wrapper.unmount()
  })

  it('кнопка «+» открывает ввод и создаёт задачу эпика по Enter', async () => {
    const wrapper = mountBlock(makeEpic())
    await wrapper.find('button[aria-label="Добавить задачу в эпик"]').trigger('click')

    expect(wrapper.text()).toContain('Задачи эпика')

    const input = wrapper.find('input')
    await input.setValue('Новая задача')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('createTask')).toEqual([['epic-1', 'Новая задача']])
    wrapper.unmount()
  })

  it('esc в поле ввода задачи ничего не создаёт', async () => {
    const wrapper = mountBlock(makeEpic())
    await wrapper.find('button[aria-label="Добавить задачу в эпик"]').trigger('click')

    const input = wrapper.find('input')
    await input.setValue('Что-то')
    await input.trigger('keydown.escape')

    expect(wrapper.emitted('createTask')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Задачи эпика')
    wrapper.unmount()
  })

  it('переименование эпика через меню испускает renameGroup', async () => {
    const wrapper = mountBlock(makeEpic())
    await openMenuItem(wrapper, 'Переименовать')

    const input = wrapper.find('input')
    await input.setValue('Обновлённое название')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('renameGroup')).toEqual([['epic-1', 'Обновлённое название']])
    wrapper.unmount()
  })

  it('«Добавить историю» через меню создаёт историю по Enter', async () => {
    const wrapper = mountBlock(makeEpic())
    await openMenuItem(wrapper, 'Добавить историю')

    const input = wrapper.find('input')
    await input.setValue('Новая история')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('createStory')).toEqual([['epic-1', 'Новая история']])
    wrapper.unmount()
  })

  it('удаление эпика через меню испускает deleteGroup с самим эпиком', async () => {
    const epic = makeEpic()
    const wrapper = mountBlock(epic)
    await openMenuItem(wrapper, 'Удалить')

    expect(wrapper.emitted('deleteGroup')).toEqual([[epic]])
    wrapper.unmount()
  })

  it('переключение статуса через меню испускает toggleGroupDone с самим эпиком', async () => {
    const epic = makeEpic({ status: 'open' })
    const wrapper = mountBlock(epic)
    await openMenuItem(wrapper, 'Закрыть')

    expect(wrapper.emitted('toggleGroupDone')).toEqual([[epic]])
    wrapper.unmount()
  })

  it('события истории пробрасываются наверх', async () => {
    const story = makeEpic({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    const wrapper = mountBlock(makeEpic(), [{ story, tasks: [] }])

    await wrapper.find('button.text-xs.font-medium').trigger('click')

    expect(wrapper.emitted('openGroup')).toEqual([['story-1']])
    wrapper.unmount()
  })
})

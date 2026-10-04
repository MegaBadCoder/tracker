import type { BoardGroupNode, Release } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import ReleaseRow from '@/features/projects/ui/ReleaseRow.vue'

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'v1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned',
    releasedAt: null,
    order: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    releaseId: 'rel-1',
    groupId: null,
    ...overrides,
  } as Task
}

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'e1',
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

function mountRow(release: Release, tasks: Task[] = []) {
  return mount(ReleaseRow, {
    props: { projectId: 'proj-1', release, tasks },
    attachTo: document.body,
  })
}

describe('releaseRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 15, 30))
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('даты: обе — «с 1 окт. по 15 окт.», только выпуск — «до 15 окт.», только начало — «с 1 окт.», нет дат — ничего', () => {
    const both = mountRow(makeRelease({ startDate: '2026-10-01', releaseDate: '2026-10-15' }))
    expect(both.get('[data-testid="release-dates"]').text()).toBe('с 1 окт. по 15 окт.')
    both.unmount()

    const onlyRelease = mountRow(makeRelease({ releaseDate: '2026-10-15' }))
    expect(onlyRelease.get('[data-testid="release-dates"]').text()).toBe('до 15 окт.')
    onlyRelease.unmount()

    const onlyStart = mountRow(makeRelease({ startDate: '2026-10-01' }))
    expect(onlyStart.get('[data-testid="release-dates"]').text()).toBe('с 1 окт.')
    onlyStart.unmount()

    const none = mountRow(makeRelease())
    expect(none.find('[data-testid="release-dates"]').exists()).toBe(false)
    none.unmount()
  })

  it('прогресс «n из m готово» считается по задачам релиза, полоска отражает процент', () => {
    const wrapper = mountRow(makeRelease(), [
      makeTask({ id: 'a', completed: true }),
      makeTask({ id: 'b', completed: false }),
      makeTask({ id: 'c', completed: true }),
      makeTask({ id: 'd', completed: false }),
    ])

    expect(wrapper.get('[data-testid="release-counter"]').text()).toBe('2 из 4 готово')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('50')
    wrapper.unmount()
  })

  it('«Просрочен» — у запланированного с датой в прошлом, но не сегодня и не у выпущенного', () => {
    const past = mountRow(makeRelease({ releaseDate: '2026-10-06' }))
    expect(past.find('[data-testid="release-overdue"]').exists()).toBe(true)
    past.unmount()

    const today = mountRow(makeRelease({ releaseDate: '2026-10-07' }))
    expect(today.find('[data-testid="release-overdue"]').exists()).toBe(false)
    today.unmount()

    const released = mountRow(makeRelease({ status: 'released', releaseDate: '2026-10-06', releasedAt: '2026-10-06T12:00:00.000Z' }))
    expect(released.find('[data-testid="release-overdue"]').exists()).toBe(false)
    released.unmount()
  })

  it('у выпущенного показано «Выпущен 15 окт.» и нет меню действий', () => {
    const wrapper = mountRow(makeRelease({ status: 'released', releasedAt: '2026-10-15T12:00:00.000Z' }))

    expect(wrapper.get('[data-testid="release-released"]').text()).toBe('Выпущен 15 окт.')
    expect(wrapper.find('button[aria-label="Действия с релизом"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('у запланированного нет строки «Выпущен»', () => {
    const wrapper = mountRow(makeRelease())

    expect(wrapper.find('[data-testid="release-released"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('меню «⋯» у запланированного: «Изменить», «Выпустить», «Удалить» эмитят события', async () => {
    const wrapper = mountRow(makeRelease())

    await wrapper.get('button[aria-label="Действия с релизом"]').trigger('click')
    await wrapper.vm.$nextTick()
    const items = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    expect(items.map(el => el.textContent?.trim())).toEqual(['Изменить', 'Выпустить', 'Удалить'])

    for (const label of ['Изменить', 'Выпустить', 'Удалить']) {
      items.find(el => el.textContent?.trim() === label)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await wrapper.vm.$nextTick()
    }

    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('release')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    wrapper.unmount()
  })

  it('список задач свёрнут, клик по шапке раскрывает и сворачивает его', async () => {
    const wrapper = mountRow(makeRelease(), [makeTask()])
    const header = wrapper.get('button[aria-label="Релиз v1.0"]')

    expect(wrapper.find('[data-testid="release-tasks"]').exists()).toBe(false)
    expect(header.attributes('aria-expanded')).toBe('false')

    await header.trigger('click')
    expect(wrapper.find('[data-testid="release-tasks"]').exists()).toBe(true)
    expect(header.attributes('aria-expanded')).toBe('true')

    await header.trigger('click')
    expect(wrapper.find('[data-testid="release-tasks"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('раскрытый список группирует задачи: «Эпик › История», «Эпик», «Без эпика»', async () => {
    const story = makeGroup({ id: 's1', type: 'story', parentId: 'e1', title: 'История' })
    useGroupStore().trees['proj-1'] = [makeGroup({ children: [story] })]
    const wrapper = mountRow(makeRelease(), [
      makeTask({ id: 'loose', groupId: null }),
      makeTask({ id: 'in-story', groupId: 's1' }),
      makeTask({ id: 'on-epic', groupId: 'e1' }),
    ])

    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')

    const buckets = wrapper.findAll('[data-testid="release-bucket"]')
    expect(buckets.map(b => b.get('[data-testid="release-bucket-caption"]').text())).toEqual([
      'Эпик',
      'Эпик › История',
      'Без эпика',
    ])
    expect(buckets.map(b => b.findAll('[data-task-id]').map(t => t.attributes('data-task-id')))).toEqual([
      ['on-epic'],
      ['in-story'],
      ['loose'],
    ])
    wrapper.unmount()
  })

  it('выполненная задача зачёркнута, клик по задаче эмитит openTask', async () => {
    const done = makeTask({ id: 'done', title: 'Готово', completed: true })
    const open = makeTask({ id: 'open', title: 'В работе' })
    const wrapper = mountRow(makeRelease(), [done, open])

    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')

    expect(wrapper.get('[data-task-id="done"]').classes()).toContain('line-through')
    expect(wrapper.get('[data-task-id="open"]').classes()).not.toContain('line-through')

    await wrapper.get('[data-task-id="open"]').trigger('click')
    expect(wrapper.emitted('openTask')).toEqual([[open]])
    wrapper.unmount()
  })

  it('показывает запланированную историю в релизе даже без задач', async () => {
    useGroupStore().trees['proj-1'] = [makeGroup({ children: [makeGroup({ id: 'empty', parentId: 'e1', type: 'story', title: 'Пустая история', releaseId: 'rel-1' })] })]
    const wrapper = mountRow(makeRelease())
    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')
    expect(wrapper.get('[data-testid="release-tasks"]').text()).toContain('Пустая история')
    expect(wrapper.text()).not.toContain('В релизе нет задач.')
    wrapper.unmount()
  })

  it('раскрытый релиз без задач сообщает, что задач нет', async () => {
    const wrapper = mountRow(makeRelease())

    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')

    expect(wrapper.get('[data-testid="release-tasks"]').text()).toContain('В релизе нет задач')
    wrapper.unmount()
  })

  it('в раскрытом списке показывает ключи задач agile-проекта с префиксом', async () => {
    useProjectStore().projects = [{
      id: 'proj-1',
      parentId: null,
      title: 'Проект',
      description: null,
      viewMode: 'board',
      type: 'agile',
      icon: null,
      color: null,
      order: 0,
      taskKeyPrefix: 'ALF',
    }]
    const wrapper = mountRow(makeRelease(), [
      makeTask({ id: 'a', number: 4 }),
      makeTask({ id: 'b', number: null }),
    ])
    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')

    const keys = wrapper.findAll('[data-testid="task-key"]')
    expect(keys.map(k => k.text())).toEqual(['ALF-4'])
    wrapper.unmount()
  })

  it('без префикса проекта ключи в списке релиза не рисуются', async () => {
    const wrapper = mountRow(makeRelease(), [makeTask({ id: 'a', number: 4 })])
    await wrapper.get('button[aria-label="Релиз v1.0"]').trigger('click')

    expect(wrapper.find('[data-testid="task-key"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

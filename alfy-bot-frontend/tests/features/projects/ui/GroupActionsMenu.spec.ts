import type { BoardGroup, Release } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReleaseStore } from '@/features/projects/model/release-store'
import GroupActionsMenu from '@/features/projects/ui/GroupActionsMenu.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

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
  beforeEach(() => {
    setActivePinia(createPinia())
    useReleaseStore().lists['proj-1'] = []
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

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

  it('без запланированных релизов пункта «В релиз…» нет', async () => {
    useReleaseStore().lists['proj-1'] = [makeRelease({ id: 'done', status: 'released', releasedAt: '2026-02-01T00:00:00.000Z' })]
    const wrapper = await openMenu(makeGroup())

    expect(document.body.textContent).not.toContain('В релиз…')

    wrapper.unmount()
  })

  it('пункт «В релиз…» есть у эпика и у истории', async () => {
    useReleaseStore().lists['proj-1'] = [makeRelease()]

    const epicWrapper = await openMenu(makeGroup({ type: 'epic' }))
    expect(document.body.textContent).toContain('В релиз…')
    epicWrapper.unmount()
    document.body.innerHTML = ''

    const storyWrapper = await openMenu(makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' }))
    expect(document.body.textContent).toContain('В релиз…')
    storyWrapper.unmount()
  })

  it('подменю содержит только запланированные релизы по порядку, выбор вызывает assignGroup', async () => {
    const store = useReleaseStore()
    store.lists['proj-1'] = [
      makeRelease({ id: 'rel-b', name: 'v2.0', order: 1 }),
      makeRelease({ id: 'rel-done', name: 'v0.9', status: 'released', releasedAt: '2026-02-01T00:00:00.000Z', order: 2 }),
      makeRelease({ id: 'rel-a', name: 'v1.0', order: 0 }),
    ]
    const assignGroup = vi.spyOn(store, 'assignGroup').mockResolvedValue(3)
    const wrapper = await openMenu(makeGroup({ id: 'epic-7' }))

    const releaseTrigger = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]'))
      .find(el => el.textContent?.includes('В релиз…')) as HTMLElement
    releaseTrigger.click()
    await flushPromises()

    const subItems = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .map(el => el.textContent?.trim())
      .filter(text => text === 'v1.0' || text === 'v2.0' || text === 'v0.9')
    expect(subItems).toEqual(['v1.0', 'v2.0'])

    const item = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .find(el => el.textContent?.trim() === 'v2.0') as HTMLElement
    item.click()
    await flushPromises()

    expect(assignGroup).toHaveBeenCalledWith('proj-1', 'rel-b', 'epic-7')

    wrapper.unmount()
  })

  it('ошибка assignGroup логируется и не ломает меню', async () => {
    const store = useReleaseStore()
    store.lists['proj-1'] = [makeRelease()]
    const failure = new Error('400')
    vi.spyOn(store, 'assignGroup').mockRejectedValue(failure)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await openMenu(makeGroup())

    const releaseTrigger = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]'))
      .find(el => el.textContent?.includes('В релиз…')) as HTMLElement
    releaseTrigger.click()
    await flushPromises()
    const item = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
      .find(el => el.textContent?.trim() === 'v1.0') as HTMLElement
    item.click()
    await flushPromises()

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure)

    wrapper.unmount()
  })

  it('при открытии меню загружает релизы проекта', async () => {
    const store = useReleaseStore()
    delete store.lists['proj-1']
    const ensureReleases = vi.spyOn(store, 'ensureReleases').mockResolvedValue()
    const wrapper = await openMenu(makeGroup())

    expect(ensureReleases).toHaveBeenCalledWith('proj-1')

    wrapper.unmount()
  })
})

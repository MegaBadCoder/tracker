import type { Release } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useReleaseStore } from '@/features/projects/model/release-store'
import ReleaseActionDialog from '@/features/projects/ui/ReleaseActionDialog.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

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
    id: 'current',
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

function makeTask(id: string, completed: boolean, releaseId: string | null = 'current'): Task {
  return { id, title: id, completed, projectId: 'proj-1', releaseId } as Task
}

function planned(id: string, order: number, name = id): Release {
  return makeRelease({ id, name, order })
}

function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim() === text)
  if (!button)
    throw new Error(`Button with text "${text}" not found`)
  return button as HTMLButtonElement
}

function radios(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
}

async function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
  await nextTick()
}

function setup(releases: Release[], tasks: Task[]) {
  useReleaseStore().lists['proj-1'] = releases
  useTaskStore().tasks = tasks
  return mount(ReleaseActionDialog, {
    props: { open: true, projectId: 'proj-1', release: releases[0]! },
    attachTo: document.body,
  })
}

describe('releaseActionDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('показывает счётчики «Выполнено N, не выполнено M»', async () => {
    const wrapper = setup(
      [makeRelease(), planned('p1', 1)],
      [makeTask('a', true), makeTask('b', true), makeTask('c', false), makeTask('other', false, 'p1')],
    )
    await flushPromises()

    expect(document.querySelector('[data-testid="release-action-summary"]')?.textContent?.trim())
      .toBe('Выполнено 2, не выполнено 1')
    wrapper.unmount()
  })

  it('цель по умолчанию — ближайший запланированный релиз по order без текущего, последствие названо заранее', async () => {
    const wrapper = setup(
      [makeRelease(), planned('p2', 2, 'Позже'), planned('p1', 1, 'Раньше')],
      [makeTask('c', false), makeTask('d', false)],
    )
    await flushPromises()

    expect(radios().map(r => r.value)).toEqual(['p1', 'p2', 'none'])
    expect(radios().find(r => r.checked)?.value).toBe('p1')
    expect(document.querySelector('[data-testid="release-action-consequence"]')?.textContent?.trim())
      .toBe('2 задачи → „Раньше“')
    wrapper.unmount()
  })

  it('без других запланированных релизов цель по умолчанию — «Снять с релиза»', async () => {
    const wrapper = setup([makeRelease()], [makeTask('c', false)])
    await flushPromises()

    expect(radios().map(r => r.value)).toEqual(['none'])
    expect(radios()[0]!.checked).toBe(true)
    expect(document.querySelector('[data-testid="release-action-consequence"]')?.textContent?.trim())
      .toBe('1 задача → без релиза')
    wrapper.unmount()
  })

  it('выпущенные релизы в целях не предлагаются', async () => {
    const wrapper = setup(
      [makeRelease(), makeRelease({ id: 'done', status: 'released', releasedAt: '2026-09-10T00:00:00.000Z', order: 1 })],
      [makeTask('c', false)],
    )
    await flushPromises()

    expect(radios().map(r => r.value)).toEqual(['none'])
    wrapper.unmount()
  })

  it('при M = 0 выбора цели нет, выпуск уходит с moveTo none', async () => {
    const wrapper = setup([makeRelease(), planned('p1', 1)], [makeTask('a', true)])
    await flushPromises()
    const releaseSpy = vi.spyOn(useReleaseStore(), 'releaseRelease').mockResolvedValue(undefined)

    expect(radios()).toHaveLength(0)
    await click(findButtonByText('Выпустить'))

    expect(releaseSpy).toHaveBeenCalledWith('proj-1', 'current', 'none')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('отправка вызывает releaseRelease с выбранной целью', async () => {
    const wrapper = setup([makeRelease(), planned('p1', 1), planned('p2', 2)], [makeTask('c', false)])
    await flushPromises()
    const releaseSpy = vi.spyOn(useReleaseStore(), 'releaseRelease').mockResolvedValue(undefined)

    await click(radios().find(r => r.value === 'p2')!)
    await click(findButtonByText('Выпустить'))

    expect(releaseSpy).toHaveBeenCalledWith('proj-1', 'current', 'p2')
    wrapper.unmount()
  })

  it('выбор «Снять с релиза» отправляет moveTo none', async () => {
    const wrapper = setup([makeRelease(), planned('p1', 1)], [makeTask('c', false)])
    await flushPromises()
    const releaseSpy = vi.spyOn(useReleaseStore(), 'releaseRelease').mockResolvedValue(undefined)

    await click(radios().find(r => r.value === 'none')!)
    await click(findButtonByText('Выпустить'))

    expect(releaseSpy).toHaveBeenCalledWith('proj-1', 'current', 'none')
    wrapper.unmount()
  })

  it('ошибка сервера показывается, диалог не закрывается', async () => {
    const wrapper = setup([makeRelease()], [makeTask('c', false)])
    await flushPromises()
    vi.spyOn(useReleaseStore(), 'releaseRelease').mockRejectedValue({
      response: { data: { message: 'Релиз уже выпущен' } },
    })

    await click(findButtonByText('Выпустить'))

    expect(document.querySelector('[data-testid="release-action-error"]')?.textContent).toContain('Релиз уже выпущен')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })
})

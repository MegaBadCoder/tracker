import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import SprintCompleteDialog from '@/features/projects/ui/SprintCompleteDialog.vue'
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

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'active',
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

function makeTask(id: string, completed: boolean, sprintId: string | null = 'active'): Task {
  return { id, title: id, completed, projectId: 'proj-1', sprintId, order: 0 } as Task
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

function setup(sprints: Sprint[], tasks: Task[]) {
  useSprintStore().lists['proj-1'] = sprints
  useTaskStore().tasks = tasks
  return mount(SprintCompleteDialog, {
    props: { open: true, projectId: 'proj-1', sprint: sprints[0]! },
    attachTo: document.body,
  })
}

function planned(id: string, order: number, name = id): Sprint {
  return makeSprint({ id, name, order, status: 'planned', startDate: null, endDate: null })
}

describe('sprintCompleteDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('показывает счётчики «Выполнено N, не выполнено M»', async () => {
    const wrapper = setup(
      [makeSprint(), planned('p1', 1)],
      [makeTask('a', true), makeTask('b', true), makeTask('c', false), makeTask('other', false, 'p1')],
    )
    await flushPromises()

    expect(document.querySelector('[data-testid="sprint-complete-summary"]')?.textContent?.trim())
      .toBe('Выполнено 2, не выполнено 1')
    wrapper.unmount()
  })

  it('цель по умолчанию — первый запланированный спринт по order, и последствие названо заранее', async () => {
    const wrapper = setup(
      [makeSprint(), planned('p2', 2, 'Позже'), planned('p1', 1, 'Раньше')],
      [makeTask('c', false), makeTask('d', false)],
    )
    await flushPromises()

    expect(radios().map(r => r.value)).toEqual(['p1', 'p2', 'backlog'])
    expect(radios().find(r => r.checked)?.value).toBe('p1')
    expect(document.querySelector('[data-testid="sprint-complete-consequence"]')?.textContent?.trim())
      .toBe('2 задачи → „Раньше“')
    wrapper.unmount()
  })

  it('без запланированных спринтов цель по умолчанию — бэклог', async () => {
    const wrapper = setup([makeSprint()], [makeTask('c', false)])
    await flushPromises()

    expect(radios().map(r => r.value)).toEqual(['backlog'])
    expect(radios()[0]!.checked).toBe(true)
    wrapper.unmount()
  })

  it('при M = 0 выбора цели нет, завершение уходит с moveTo backlog', async () => {
    const wrapper = setup([makeSprint(), planned('p1', 1)], [makeTask('a', true)])
    await flushPromises()
    const completeSpy = vi.spyOn(useSprintStore(), 'completeSprint').mockResolvedValue(undefined)

    expect(radios()).toHaveLength(0)
    await click(findButtonByText('Завершить'))

    expect(completeSpy).toHaveBeenCalledWith('proj-1', 'active', 'backlog')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('отправка вызывает completeSprint с выбранной целью', async () => {
    const wrapper = setup([makeSprint(), planned('p1', 1), planned('p2', 2)], [makeTask('c', false)])
    await flushPromises()
    const completeSpy = vi.spyOn(useSprintStore(), 'completeSprint').mockResolvedValue(undefined)

    await click(radios().find(r => r.value === 'p2')!)
    await click(findButtonByText('Завершить'))

    expect(completeSpy).toHaveBeenCalledWith('proj-1', 'active', 'p2')
    wrapper.unmount()
  })

  it('выбор «Бэклог» отправляет moveTo backlog', async () => {
    const wrapper = setup([makeSprint(), planned('p1', 1)], [makeTask('c', false)])
    await flushPromises()
    const completeSpy = vi.spyOn(useSprintStore(), 'completeSprint').mockResolvedValue(undefined)

    await click(radios().find(r => r.value === 'backlog')!)
    await click(findButtonByText('Завершить'))

    expect(completeSpy).toHaveBeenCalledWith('proj-1', 'active', 'backlog')
    wrapper.unmount()
  })

  it('ошибка сервера показывается, диалог не закрывается', async () => {
    const wrapper = setup([makeSprint()], [makeTask('c', false)])
    await flushPromises()
    vi.spyOn(useSprintStore(), 'completeSprint').mockRejectedValue({
      response: { data: { message: 'Спринт уже завершён' } },
    })

    await click(findButtonByText('Завершить'))

    expect(document.querySelector('[data-testid="sprint-complete-error"]')?.textContent).toContain('Спринт уже завершён')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })
})

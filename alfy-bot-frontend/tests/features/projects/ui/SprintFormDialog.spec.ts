import type { Sprint } from '@/features/projects/model/types'
import { CalendarDate } from '@internationalized/date'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { Calendar } from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { toLocalISODate } from '@/features/goals/lib/dates'
import { sprintEndFromDuration } from '@/features/projects/lib/sprint'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import SprintFormDialog from '@/features/projects/ui/SprintFormDialog.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

const TODAY = new Date(2026, 8, 29)

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

function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim() === text)
  if (!button)
    throw new Error(`Button with text "${text}" not found`)
  return button as HTMLButtonElement
}

function findByLabel<T extends HTMLElement>(label: string): T {
  const el = document.querySelector<T>(`[aria-label="${label}"]`)
  if (!el)
    throw new Error(`Element with aria-label "${label}" not found`)
  return el
}

async function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flushPromises()
  await nextTick()
}

async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

function mountDialog(mode: 'start' | 'edit', sprint: Sprint = makeSprint()) {
  return mount(SprintFormDialog, {
    props: { open: true, mode, projectId: 'proj-1', sprint },
    attachTo: document.body,
  })
}

describe('sprintFormDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('в режиме start длительность по умолчанию 2 недели, начало сегодня, конец через sprintEndFromDuration', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()

    expect(findButtonByText('2 нед.').getAttribute('aria-pressed')).toBe('true')
    expect(findButtonByText('1 нед.').getAttribute('aria-pressed')).toBe('false')

    const startSpy = vi.spyOn(useSprintStore(), 'startSprint').mockResolvedValue(undefined)
    await click(findButtonByText('Начать'))

    expect(startSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', {
      startDate: toLocalISODate(TODAY),
      endDate: toLocalISODate(sprintEndFromDuration(TODAY, 2)),
      goal: null,
    })
    wrapper.unmount()
  })

  it('смена начала при выбранной длительности сдвигает конец', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    const startSpy = vi.spyOn(useSprintStore(), 'startSprint').mockResolvedValue(undefined)

    await click(findByLabel('Дата начала'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 5))
    await flushPromises()
    await click(findButtonByText('Начать'))

    expect(startSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', expect.objectContaining({
      startDate: '2026-10-05',
      endDate: '2026-10-18',
    }))
    wrapper.unmount()
  })

  it('смена длительности пересчитывает конец', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    const startSpy = vi.spyOn(useSprintStore(), 'startSprint').mockResolvedValue(undefined)

    await click(findButtonByText('4 нед.'))
    await click(findButtonByText('Начать'))

    expect(startSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', expect.objectContaining({
      endDate: toLocalISODate(sprintEndFromDuration(TODAY, 4)),
    }))
    wrapper.unmount()
  })

  it('ручной выбор конца переводит длительность в «Свой срок» и сохраняет выбранную дату', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    const startSpy = vi.spyOn(useSprintStore(), 'startSprint').mockResolvedValue(undefined)

    await click(findByLabel('Дата окончания'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 20))
    await flushPromises()

    expect(findButtonByText('Свой срок').getAttribute('aria-pressed')).toBe('true')
    expect(findButtonByText('2 нед.').getAttribute('aria-pressed')).toBe('false')

    await click(findButtonByText('Начать'))

    expect(startSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', expect.objectContaining({ endDate: '2026-10-20' }))
    wrapper.unmount()
  })

  it('календари получают locale и week-starts-on из useLocale и ограничивают друг друга', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()

    await click(findByLabel('Дата начала'))
    const startCalendar = wrapper.findComponent(Calendar)
    expect(startCalendar.props('locale')).toBe(intlLocale.value)
    expect(startCalendar.props('weekStartsOn')).toBe(weekStartsOn.value)
    expect(startCalendar.props('maxValue')).toEqual(new CalendarDate(2026, 10, 12))

    startCalendar.vm.$emit('update:modelValue', new CalendarDate(2026, 9, 29))
    await flushPromises()

    await click(findByLabel('Дата окончания'))
    const endCalendar = wrapper.findComponent(Calendar)
    expect(endCalendar.props('locale')).toBe(intlLocale.value)
    expect(endCalendar.props('weekStartsOn')).toBe(weekStartsOn.value)
    expect(endCalendar.props('minValue')).toEqual(new CalendarDate(2026, 9, 29))
    wrapper.unmount()
  })

  it('отправка в режиме start передаёт цель и ставит имя через updateSprint только при его изменении', async () => {
    const wrapper = mountDialog('start', makeSprint({ name: 'Спринт 1', goal: 'Старая цель' }))
    await flushPromises()
    const store = useSprintStore()
    const updateSpy = vi.spyOn(store, 'updateSprint').mockResolvedValue(undefined)
    const startSpy = vi.spyOn(store, 'startSprint').mockResolvedValue(undefined)

    await type(findByLabel<HTMLInputElement>('Название спринта'), 'Релиз')
    await type(findByLabel<HTMLTextAreaElement>('Цель спринта'), 'Выпустить MVP')
    await click(findButtonByText('Начать'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', { name: 'Релиз' })
    expect(startSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', {
      startDate: '2026-09-29',
      endDate: '2026-10-12',
      goal: 'Выпустить MVP',
    })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('без изменения имени updateSprint не вызывается', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    const store = useSprintStore()
    const updateSpy = vi.spyOn(store, 'updateSprint').mockResolvedValue(undefined)
    vi.spyOn(store, 'startSprint').mockResolvedValue(undefined)

    await click(findButtonByText('Начать'))

    expect(updateSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('пустое имя блокирует кнопку отправки', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    const startSpy = vi.spyOn(useSprintStore(), 'startSprint').mockResolvedValue(undefined)

    await type(findByLabel<HTMLInputElement>('Название спринта'), '   ')

    expect(findButtonByText('Начать').disabled).toBe(true)
    await click(findButtonByText('Начать'))
    expect(startSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('начало позже конца блокирует кнопку и показывает причину', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()

    await click(findByLabel('Дата окончания'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 5))
    await flushPromises()
    await click(findByLabel('Дата начала'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 20))
    await flushPromises()

    expect(findButtonByText('Начать').disabled).toBe(true)
    expect(document.body.textContent).toContain('Дата начала позже даты окончания')
    wrapper.unmount()
  })

  it('в режиме edit нет выбора длительности, отправляются только изменённые поля через updateSprint', async () => {
    const wrapper = mountDialog('edit', makeSprint({ name: 'Спринт 1', goal: 'Цель' }))
    await flushPromises()
    const store = useSprintStore()
    const updateSpy = vi.spyOn(store, 'updateSprint').mockResolvedValue(undefined)
    const startSpy = vi.spyOn(store, 'startSprint').mockResolvedValue(undefined)

    expect(document.body.textContent).not.toContain('Длительность')
    expect(document.body.textContent).toContain('Не задано')

    await type(findByLabel<HTMLInputElement>('Название спринта'), 'Новое имя')
    await click(findButtonByText('Сохранить'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', { name: 'Новое имя' })
    expect(startSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('в режиме edit дату можно очистить: в updateSprint уходит null', async () => {
    const wrapper = mountDialog('edit', makeSprint({ startDate: '2026-10-05', endDate: '2026-10-18' }))
    await flushPromises()
    const updateSpy = vi.spyOn(useSprintStore(), 'updateSprint').mockResolvedValue(undefined)

    await click(findByLabel('Очистить дату окончания'))
    await click(findButtonByText('Сохранить'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'sprint-1', { endDate: null })
    wrapper.unmount()
  })

  it('ошибка сервера показывается в диалоге, диалог остаётся открытым', async () => {
    const wrapper = mountDialog('start')
    await flushPromises()
    vi.spyOn(useSprintStore(), 'startSprint').mockRejectedValue({
      response: { data: { message: 'В проекте уже есть активный спринт' } },
    })

    await click(findButtonByText('Начать'))

    expect(document.querySelector('[data-testid="sprint-form-error"]')?.textContent).toContain('В проекте уже есть активный спринт')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(findButtonByText('Начать').disabled).toBe(false)
    wrapper.unmount()
  })
})

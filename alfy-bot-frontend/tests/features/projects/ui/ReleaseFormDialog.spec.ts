import type { Release } from '@/features/projects/model/types'
import { CalendarDate } from '@internationalized/date'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { Calendar } from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { useReleaseStore } from '@/features/projects/model/release-store'
import ReleaseFormDialog from '@/features/projects/ui/ReleaseFormDialog.vue'

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
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
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

function mountDialog(release: Release = makeRelease()) {
  return mount(ReleaseFormDialog, {
    props: { open: true, projectId: 'proj-1', release },
    attachTo: document.body,
  })
}

describe('releaseFormDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('заполняет поля значениями релиза', async () => {
    const wrapper = mountDialog(makeRelease({ name: 'v2.0', description: 'Большой релиз', startDate: '2026-10-01', releaseDate: '2026-10-15' }))
    await flushPromises()

    expect(findByLabel<HTMLInputElement>('Название релиза').value).toBe('v2.0')
    expect(findByLabel<HTMLTextAreaElement>('Описание релиза').value).toBe('Большой релиз')
    expect(document.body.textContent).toContain('1 окт. 2026')
    expect(document.body.textContent).toContain('15 окт. 2026')
    wrapper.unmount()
  })

  it('отправляет через updateRelease только изменённые поля и закрывается', async () => {
    const wrapper = mountDialog(makeRelease({ description: 'Старое' }))
    await flushPromises()
    const updateSpy = vi.spyOn(useReleaseStore(), 'updateRelease').mockResolvedValue(undefined)

    await type(findByLabel<HTMLInputElement>('Название релиза'), 'v1.1')
    await type(findByLabel<HTMLTextAreaElement>('Описание релиза'), '')
    await click(findButtonByText('Сохранить'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'rel-1', { name: 'v1.1', description: null })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('без изменений updateRelease не вызывается, диалог закрывается', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const updateSpy = vi.spyOn(useReleaseStore(), 'updateRelease').mockResolvedValue(undefined)

    await click(findButtonByText('Сохранить'))

    expect(updateSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('выбор дат в календаре уходит в updateRelease как YYYY-MM-DD', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const updateSpy = vi.spyOn(useReleaseStore(), 'updateRelease').mockResolvedValue(undefined)

    await click(findByLabel('Дата начала'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 1))
    await flushPromises()
    await click(findByLabel('Дата выпуска'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 15))
    await flushPromises()
    await click(findButtonByText('Сохранить'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'rel-1', { startDate: '2026-10-01', releaseDate: '2026-10-15' })
    wrapper.unmount()
  })

  it('календари получают locale и week-starts-on из useLocale и ограничивают друг друга', async () => {
    const wrapper = mountDialog(makeRelease({ startDate: '2026-10-01', releaseDate: '2026-10-15' }))
    await flushPromises()

    await click(findByLabel('Дата начала'))
    const startCalendar = wrapper.findComponent(Calendar)
    expect(startCalendar.props('locale')).toBe(intlLocale.value)
    expect(startCalendar.props('weekStartsOn')).toBe(weekStartsOn.value)
    expect(startCalendar.props('maxValue')).toEqual(new CalendarDate(2026, 10, 15))

    startCalendar.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 3))
    await flushPromises()

    await click(findByLabel('Дата выпуска'))
    const releaseCalendar = wrapper.findComponent(Calendar)
    expect(releaseCalendar.props('locale')).toBe(intlLocale.value)
    expect(releaseCalendar.props('weekStartsOn')).toBe(weekStartsOn.value)
    expect(releaseCalendar.props('minValue')).toEqual(new CalendarDate(2026, 10, 3))
    wrapper.unmount()
  })

  it('дату можно очистить: в updateRelease уходит null', async () => {
    const wrapper = mountDialog(makeRelease({ startDate: '2026-10-01', releaseDate: '2026-10-15' }))
    await flushPromises()
    const updateSpy = vi.spyOn(useReleaseStore(), 'updateRelease').mockResolvedValue(undefined)

    await click(findByLabel('Очистить дату выпуска'))
    await click(findButtonByText('Сохранить'))

    expect(updateSpy).toHaveBeenCalledWith('proj-1', 'rel-1', { releaseDate: null })
    wrapper.unmount()
  })

  it('пустое название блокирует кнопку сохранения', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const updateSpy = vi.spyOn(useReleaseStore(), 'updateRelease').mockResolvedValue(undefined)

    await type(findByLabel<HTMLInputElement>('Название релиза'), '   ')

    expect(findButtonByText('Сохранить').disabled).toBe(true)
    await click(findButtonByText('Сохранить'))
    expect(updateSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('начало позже выпуска блокирует кнопку и показывает причину', async () => {
    const wrapper = mountDialog(makeRelease({ startDate: '2026-10-01', releaseDate: '2026-10-15' }))
    await flushPromises()

    await click(findByLabel('Дата начала'))
    wrapper.findComponent(Calendar).vm.$emit('update:modelValue', new CalendarDate(2026, 10, 20))
    await flushPromises()

    expect(findButtonByText('Сохранить').disabled).toBe(true)
    expect(document.body.textContent).toContain('Дата начала позже даты выпуска')
    wrapper.unmount()
  })

  it('ошибка сервера показывается в диалоге, диалог остаётся открытым', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    vi.spyOn(useReleaseStore(), 'updateRelease').mockRejectedValue({
      response: { data: { message: 'Выпущенный релиз нельзя изменить' } },
    })

    await type(findByLabel<HTMLInputElement>('Название релиза'), 'v1.1')
    await click(findButtonByText('Сохранить'))

    expect(document.querySelector('[data-testid="release-form-error"]')?.textContent).toContain('Выпущенный релиз нельзя изменить')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(findButtonByText('Сохранить').disabled).toBe(false)
    wrapper.unmount()
  })
})

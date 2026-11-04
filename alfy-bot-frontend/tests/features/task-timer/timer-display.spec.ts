import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, provide } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useTimerDisplayStore } from '@/features/task-timer/model/timer-display-store'
import { useTimerStore } from '@/features/task-timer/model/timer-store'
import TimeBlock from '@/features/task-timer/ui/TimeBlock.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ back: vi.fn() }) }))
vi.mock('@/composables/useSse', () => ({ useSse: vi.fn() }))
vi.mock('@/composables/useSounds', () => ({ useSounds: () => ({ play: vi.fn() }) }))
vi.mock('@/api/client', () => ({
  api: { put: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) },
}))

const Harness = defineComponent({
  components: { AppHeader, TimeBlock },
  setup() {
    provide('taskTimerAvailable', true)
  },
  template: '<AppHeader title="Задачи" /><TimeBlock />',
})

describe('тихий режим таймера', () => {
  let pinia: ReturnType<typeof createPinia>
  let wrapper: VueWrapper

  beforeEach(() => {
    window.localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    const timer = useTimerStore()
    vi.spyOn(timer, 'restoreSession').mockResolvedValue()
    timer.nextPhase()
    timer.timeBlock = 2470
    wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [pinia] } })
  })

  afterEach(() => {
    useTimerStore().pauseTimer()
    wrapper.unmount()
    disposePinia(pinia)
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function collapse() {
    await wrapper.get('[aria-label="Свернуть таймер в шапку"]').trigger('click')
    await flushPromises()
  }

  async function openControls() {
    await wrapper.get('.quiet-timer').trigger('click')
    await flushPromises()
  }

  async function clickControl(label: string) {
    const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
    expect(button).not.toBeNull()
    button!.click()
    await flushPromises()
  }

  it('сворачивается в шапку без изменения сессии и продолжает отсчёт', async () => {
    const timer = useTimerStore()
    const startedAt = Date.now()
    const now = vi.spyOn(Date, 'now').mockReturnValue(startedAt)
    timer.startTimer()
    const interval = timer.timerInterval
    await collapse()

    expect(wrapper.find('.timer-compact').exists()).toBe(false)
    expect(wrapper.get('header .quiet-timer').text()).toBe('41:10')
    expect(timer.isActive).toBe(true)
    expect(timer.timerInterval).toBe(interval)
    expect(timer.timeBlock).toBe(2470)
    expect(timer.phase).toBe(1)

    now.mockReturnValue(startedAt + 1000)
    timer.recalcTimeBlock()
    await nextTick()
    expect(wrapper.get('.quiet-timer').text()).toBe('41:09')
  })

  it('открывает управление только нажатием, ставит паузу и продолжает таймер', async () => {
    useTimerStore().startTimer()
    await collapse()
    await wrapper.get('.quiet-timer').trigger('mouseenter')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await openControls()
    await clickControl('Приостановить таймер')
    expect(useTimerStore().isActive).toBe(false)
    expect(wrapper.get('.quiet-timer').attributes('aria-label')).toContain('пауза')
    expect(wrapper.get('.quiet-timer').classes()).not.toContain('quiet-timer-work')
    await clickControl('Продолжить таймер')
    expect(useTimerStore().isActive).toBe(true)
  })

  it('закрывает управление по Escape и возвращает фокус кругу', async () => {
    await collapse()
    await openControls()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.get('.quiet-timer').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('.quiet-timer').element)
  })

  it('возвращается из полного экрана в круг без нижней панели', async () => {
    await collapse()
    await openControls()
    await clickControl('Открыть таймер на весь экран')
    expect(wrapper.find('.quiet-timer').exists()).toBe(false)
    expect(wrapper.find('.timer-fullscreen').exists()).toBe(true)
    await clickControl('Выйти из полноэкранного таймера')
    expect(wrapper.find('.timer-fullscreen').exists()).toBe(false)
    expect(wrapper.find('.timer-compact').exists()).toBe(false)
    expect(wrapper.find('.quiet-timer').exists()).toBe(true)
  })

  it('завершает интервал без раскрытия панели и сохраняет режим при пересоздании store', async () => {
    useTimerStore().startTimer()
    await collapse()
    await openControls()
    await clickControl('Завершить интервал')
    expect(useTimerStore().phase).toBe(2)
    expect(wrapper.find('.timer-compact').exists()).toBe(false)
    expect(wrapper.get('.quiet-timer').text()).toBe('05:00')

    const restoredPinia = createPinia()
    expect(useTimerDisplayStore(restoredPinia).isQuiet).toBe(true)
    disposePinia(restoredPinia)
    setActivePinia(pinia)
  })

  it('возвращает нижнюю панель по явному выбору и запоминает его', async () => {
    await collapse()
    await openControls()
    const button = Array.from(document.querySelectorAll('button')).find(node => node.textContent?.includes('Вернуть нижнюю панель'))
    button!.click()
    await flushPromises()
    expect(wrapper.find('.quiet-timer').exists()).toBe(false)
    expect(wrapper.find('.timer-compact').exists()).toBe(true)
    expect(window.localStorage.getItem('alfy:timer:quiet')).toBe('false')
  })

  it('оставляет круг закрытым при автоматическом окончании отсчёта', async () => {
    const timer = useTimerStore()
    const startedAt = Date.now()
    const now = vi.spyOn(Date, 'now').mockReturnValue(startedAt)
    timer.startTimer()
    await collapse()
    now.mockReturnValue(startedAt + 2470000)
    timer.recalcTimeBlock()
    await nextTick()

    expect(timer.phase).toBe(2)
    expect(timer.isActive).toBe(false)
    expect(wrapper.get('.quiet-timer').text()).toBe('05:00')
    expect(wrapper.get('.quiet-timer').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.timer-compact').exists()).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('убирает круг и открытое управление после сброса сессии', async () => {
    await collapse()
    await openControls()
    await useTimerStore().resetToInitialState()
    await flushPromises()
    expect(wrapper.find('.quiet-timer').exists()).toBe(false)
    expect(wrapper.find('.timer-compact').exists()).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import type { Task } from '@/features/tasks/model/types'
import { PRIORITY_LABELS } from '@/features/tasks/model/constants'

const apiPayloadToTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Тестовая задача',
  description: 'Описание из формы',
  completed: false,
  priority: 'high',
  tags: ['важно', 'срочно'],
  isPomodoroTask: true,
  pomodoroCompleted: 0,
  pomodoroCount: 4,
  pomodoroDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  ...overrides,
})

describe('TaskCard', () => {
  it('рендерит title из payload API', () => {
    const task = apiPayloadToTask()
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toContain('Тестовая задача')
  })

  it('рендерит priority dot и chip с корректным label', () => {
    const task = apiPayloadToTask({ priority: 'high' })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.find('.bg-red-500').exists()).toBe(true)
    expect(wrapper.text()).toContain(PRIORITY_LABELS.high)
  })

  it('рендерит priority medium и low', () => {
    const wrapperMed = mount(TaskCard, { props: { task: apiPayloadToTask({ priority: 'medium' }) } })
    const wrapperLow = mount(TaskCard, { props: { task: apiPayloadToTask({ priority: 'low' }) } })

    expect(wrapperMed.find('.bg-yellow-500').exists()).toBe(true)
    expect(wrapperMed.text()).toContain(PRIORITY_LABELS.medium)
    expect(wrapperLow.find('.bg-green-500').exists()).toBe(true)
    expect(wrapperLow.text()).toContain(PRIORITY_LABELS.low)
  })

  it('рендерит tags из payload', () => {
    const task = apiPayloadToTask({ tags: ['важно', 'срочно', 'тест'] })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toContain('важно')
    expect(wrapper.text()).toContain('срочно')
    expect(wrapper.text()).toContain('+1')
  })

  it('не показывает tags-block при пустом tags', () => {
    const task = apiPayloadToTask({ tags: [] })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).not.toContain('важно')
    expect(wrapper.text()).not.toMatch(/\+\d+/)
  })

  it('рендерит pomodoro badge при isPomodoroTask', () => {
    const task = apiPayloadToTask({
      isPomodoroTask: true,
      pomodoroCompleted: 2,
      pomodoroCount: 6,
    })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toMatch(/2\/6/)
  })

  it('показывает 0/N когда pomodoroCompleted отсутствует', () => {
    const task = apiPayloadToTask({
      isPomodoroTask: true,
      pomodoroCount: 4,
    })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toMatch(/0\/4/)
  })

  it('применяет completed-стили', () => {
    const task = apiPayloadToTask({ completed: true })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.find('.line-through').exists()).toBe(true)
    expect(wrapper.find('.opacity-50').exists()).toBe(true)
  })

  it('обрабатывает task без опциональных полей', () => {
    const task: Task = {
      id: 'minimal',
      title: 'Минимальная',
      completed: false,
    }
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toContain('Минимальная')
    expect(wrapper.find('.bg-red-500').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/\d+\/\d+/)
  })

  it('эмитит toggle при клике по checkbox', async () => {
    const task = apiPayloadToTask()
    const wrapper = mount(TaskCard, { props: { task } })

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)

    expect(wrapper.emitted('toggle')).toEqual([['1']])
  })

  it('эмитит showTimer при клике по pomodoro badge', async () => {
    const task = apiPayloadToTask({
      isPomodoroTask: true,
      priority: undefined,
      tags: [],
    })
    const wrapper = mount(TaskCard, { props: { task } })

    const pomodoroBadge = wrapper.find('[data-slot="badge"]')
    await pomodoroBadge.trigger('click')

    expect(wrapper.emitted('showTimer')).toEqual([['1']])
  })
})

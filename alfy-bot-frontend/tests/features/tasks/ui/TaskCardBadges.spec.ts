import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCardBadges from '@/features/tasks/ui/TaskCardBadges.vue'
import { PRIORITY_LABELS } from '@/features/tasks/model/constants'
import type { Priority } from '@/features/tasks/model/constants'

interface ApiPayloadShape {
  priority?: Priority
  tags?: string[]
  isPomodoroTask?: boolean
  pomodoroCompleted?: number
  pomodoroCount?: number
  dueDate?: Date
  deadline?: Date
  location?: string
}

const apiPayloadToBadgesProps = (payload: ApiPayloadShape) => ({
  priority: payload.priority ? PRIORITY_LABELS[payload.priority] : undefined,
  tags: payload.tags ?? [],
  isPomodoroTask: payload.isPomodoroTask ?? false,
  pomodoroCompleted: payload.pomodoroCompleted ?? 0,
  pomodoroCount: payload.pomodoroCount ?? 4,
  dueDate: payload.dueDate,
  deadline: payload.deadline,
  location: payload.location,
})

describe('TaskCardBadges', () => {
  it('рендерит priority label из payload', () => {
    const props = apiPayloadToBadgesProps({ priority: 'high' })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toContain(PRIORITY_LABELS.high)
  })

  it('рендерит все priority варианты', () => {
    const priorities: Priority[] = ['high', 'medium', 'low']
    for (const p of priorities) {
      const wrapper = mount(TaskCardBadges, {
        props: apiPayloadToBadgesProps({ priority: p }),
      })
      expect(wrapper.text()).toContain(PRIORITY_LABELS[p])
    }
  })

  it('рендерит tags из payload', () => {
    const props = apiPayloadToBadgesProps({ tags: ['важно', 'срочно'] })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toContain('важно')
    expect(wrapper.text()).toContain('срочно')
  })

  it('рендерит pomodoro 2/6 из payload', () => {
    const props = apiPayloadToBadgesProps({
      isPomodoroTask: true,
      pomodoroCompleted: 2,
      pomodoroCount: 6,
    })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toMatch(/2\/6/)
  })

  it('показывает 0/4 при дефолтных pomodoro', () => {
    const props = apiPayloadToBadgesProps({
      isPomodoroTask: true,
      pomodoroCompleted: 0,
      pomodoroCount: 4,
    })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toMatch(/0\/4/)
  })

  it('рендерит dueDate и deadline', () => {
    const due = new Date(2025, 2, 15)
    const deadline = new Date(2025, 2, 20, 14, 30)
    const props = apiPayloadToBadgesProps({ dueDate: due, deadline })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toContain('мар.')
    expect(wrapper.text()).toContain('15')
    expect(wrapper.text()).toContain('20')
    expect(wrapper.text()).toMatch(/14:30/)
  })

  it('рендерит location', () => {
    const props = apiPayloadToBadgesProps({ location: 'Офис' })
    const wrapper = mount(TaskCardBadges, { props })

    expect(wrapper.text()).toContain('Офис')
  })

  it('эмитит showTimer при клике по pomodoro badge', async () => {
    const props = apiPayloadToBadgesProps({ isPomodoroTask: true })
    const wrapper = mount(TaskCardBadges, { props })

    const pomodoroBadge = wrapper.findAll('.cursor-pointer').find(b => b.text().includes('/'))
    await pomodoroBadge?.trigger('click')

    expect(wrapper.emitted('showTimer')).toHaveLength(1)
  })

  it('не падает при пустых/отсутствующих опциях', () => {
    const wrapper = mount(TaskCardBadges, {
      props: {},
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toBe('')
  })
})

import type { Project } from '@/features/projects/model/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/features/projects/model/project-store'
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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list',
    type: 'agile',
    icon: null,
    color: null,
    order: 0,
    taskKeyPrefix: 'ALF',
    ...overrides,
  }
}

describe('TaskCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('показывает ключ задачи у agile-проекта с префиксом', () => {
    useProjectStore().projects = [makeProject()]
    const wrapper = mount(TaskCard, {
      props: { task: apiPayloadToTask({ projectId: 'proj-1', number: 12 }) },
    })

    const key = wrapper.get('[data-testid="task-key"]')
    expect(key.text()).toBe('ALF-12')
    expect(key.classes()).toContain('shrink-0')
  })

  it('не показывает ключ у обычного проекта', () => {
    useProjectStore().projects = [makeProject({ type: 'simple' })]
    const wrapper = mount(TaskCard, {
      props: { task: apiPayloadToTask({ projectId: 'proj-1', number: 12 }) },
    })

    expect(wrapper.find('[data-testid="task-key"]').exists()).toBe(false)
  })

  it('не показывает ключ у agile-проекта без префикса и у задачи без проекта', () => {
    useProjectStore().projects = [makeProject({ taskKeyPrefix: null })]
    const withoutPrefix = mount(TaskCard, {
      props: { task: apiPayloadToTask({ projectId: 'proj-1', number: 12 }) },
    })
    const inbox = mount(TaskCard, {
      props: { task: apiPayloadToTask({ projectId: null, number: null }) },
    })

    expect(withoutPrefix.find('[data-testid="task-key"]').exists()).toBe(false)
    expect(inbox.find('[data-testid="task-key"]').exists()).toBe(false)
  })

  it('ключ показывается и в compact-варианте, название остаётся обрезаемым', () => {
    useProjectStore().projects = [makeProject()]
    const wrapper = mount(TaskCard, {
      props: { task: apiPayloadToTask({ projectId: 'proj-1', number: 3 }), variant: 'compact' },
    })

    expect(wrapper.get('[data-testid="task-key"]').text()).toBe('ALF-3')
    expect(wrapper.findAll('span.truncate').some(el => el.text() === 'Тестовая задача')).toBe(true)
  })

  it('рендерит title из payload API', () => {
    const task = apiPayloadToTask()
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toContain('Тестовая задача')
  })

  it('рендерит priority chip с корректным label и иконкой', () => {
    const task = apiPayloadToTask({ priority: 'high' })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.find('.text-red-500').exists()).toBe(true)
    expect(wrapper.text()).toContain(PRIORITY_LABELS.high)
  })

  it('рендерит priority medium и low', () => {
    const wrapperMed = mount(TaskCard, { props: { task: apiPayloadToTask({ priority: 'medium' }) } })
    const wrapperLow = mount(TaskCard, { props: { task: apiPayloadToTask({ priority: 'low' }) } })

    expect(wrapperMed.find('.text-yellow-500').exists()).toBe(true)
    expect(wrapperMed.text()).toContain(PRIORITY_LABELS.medium)
    expect(wrapperLow.find('.text-green-500').exists()).toBe(true)
    expect(wrapperLow.text()).toContain(PRIORITY_LABELS.low)
  })

  it('рендерит tags из payload', () => {
    const task = apiPayloadToTask({ tags: ['важно', 'срочно', 'тест'] })
    const wrapper = mount(TaskCard, { props: { task } })

    expect(wrapper.text()).toContain('важно')
    expect(wrapper.text()).toContain('срочно')
    expect(wrapper.text()).toContain('+1')
  })

  it('рендерит бейдж Цели при одной привязанной цели', () => {
    const wrapper = mount(TaskCard, {
      props: { task: apiPayloadToTask({ goalIds: [1], priority: undefined, tags: [], isPomodoroTask: false }) },
    })
    expect(wrapper.find('[data-testid="task-goal-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Цель')
  })

  it('рендерит N цели при нескольких целях', () => {
    const wrapper = mount(TaskCard, {
      props: { task: apiPayloadToTask({ goalIds: [1, 2], priority: undefined, tags: [], isPomodoroTask: false }) },
    })
    expect(wrapper.text()).toContain('2 цели')
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

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AgileTaskCard from '@/features/projects/ui/AgileTaskCard.vue'
import { useProjectStore } from '@/features/projects/model/project-store'
import type { Task } from '@/features/tasks/model/types'
import type { Project } from '@/features/projects/model/types'

describe('AgileTaskCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useProjectStore().projects = [{ id: 'p1', type: 'agile', taskKeyPrefix: 'DEMO' } as Project]
  })

  const task = { id: 't1', projectId: 'p1', number: 12, title: 'Длинное название задачи', completed: false } as Task

  it('показывает ключ и открывает задачу без чекбокса и ручки перетаскивания', async () => {
    const wrapper = mount(AgileTaskCard, { props: { task } })
    expect(wrapper.get('[data-testid="task-key"]').text()).toBe('DEMO-12')
    expect(wrapper.find('[role="checkbox"], input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Перетащить задачу"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Выполнено')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toEqual([[task]])
  })

  it('показывает выполненное состояние и сохраняет название читаемым', () => {
    const wrapper = mount(AgileTaskCard, { props: { task: { ...task, completed: true } } })
    expect(wrapper.text()).toContain('Выполнено')
    expect(wrapper.text()).toContain(task.title)
    expect(wrapper.find('.line-through').exists()).toBe(false)
  })
})

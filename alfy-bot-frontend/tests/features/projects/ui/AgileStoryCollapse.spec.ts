import type { BoardGroupNode, ProjectColumn } from '@/features/projects/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AgileStoryBlock from '@/features/projects/ui/AgileStoryBlock.vue'

const story = { id: 'story-1', projectId: 'project-1', parentId: 'epic-1', title: 'Принимать оплату', type: 'story', status: 'open', children: [] } as unknown as BoardGroupNode
const lanes = [{ id: 'todo', title: 'К выполнению', projectId: story.projectId, order: 0 }] as ProjectColumn[]
const stubs = {
  StoryStatusPicker: { template: '<span>В работе</span>' },
  GroupActionsMenu: true,
  GroupOrderControls: true,
  AgileCell: { template: '<div data-testid="story-cell">Проверить оплату</div>' },
  InlineTitleInput: { template: '<input aria-label="Название задачи">' },
}
function render(value = story) {
  return mount(AgileStoryBlock, { props: { story: value, tasks: [], lanes }, global: { stubs } })
}

beforeEach(() => {
  localStorage.removeItem('alfy-board-collapsed-stories')
  setActivePinia(createPinia())
})

describe('сворачивание истории на доске', () => {
  it('скрывает клетки, сохраняя доступный заголовок и статус', async () => {
    const wrapper = render()
    const toggle = wrapper.get('button[aria-label="Свернуть историю Принимать оплату"]')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="story-cell"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Принимать оплату')
    expect(wrapper.text()).toContain('В работе')
    expect(wrapper.get('button[aria-label="Развернуть историю Принимать оплату"]').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('сохраняет состояние при возвращении и отличает другую историю', async () => {
    const first = render()
    await first.get('button[aria-label="Свернуть историю Принимать оплату"]').trigger('click')
    first.unmount()
    setActivePinia(createPinia())
    const restored = render()
    expect(restored.find('[data-testid="story-cell"]').exists()).toBe(false)
    await restored.setProps({ story: { ...story, id: 'story-2' } })
    expect(restored.find('[data-testid="story-cell"]').exists()).toBe(true)
    restored.unmount()
  })

  it('раскрывает историю при добавлении задачи', async () => {
    const wrapper = render()
    await wrapper.get('button[aria-label="Свернуть историю Принимать оплату"]').trigger('click')
    await wrapper.get('button[aria-label="Добавить задачу в историю"]').trigger('click')
    expect(wrapper.find('[data-testid="story-cell"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="Название задачи"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

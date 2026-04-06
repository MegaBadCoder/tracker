import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectBadge from '@/features/projects/ui/ProjectBadge.vue'

describe('ProjectBadge', () => {
  it('рендерит переданное название проекта', () => {
    const wrapper = mount(ProjectBadge, {
      props: { name: 'Мой проект' },
    })

    expect(wrapper.text()).toContain('Мой проект')
  })

  it('показывает иконку FolderOpen', () => {
    const wrapper = mount(ProjectBadge, {
      props: { name: 'Проект' },
    })

    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('применяет цвет если передан', () => {
    const wrapper = mount(ProjectBadge, {
      props: { name: 'Проект', color: '#ff0000' },
    })

    const icon = wrapper.find('svg')
    expect(icon.attributes('style')).toContain('color: #ff0000')
  })

  it('рендерит без цвета если color не передан', () => {
    const wrapper = mount(ProjectBadge, {
      props: { name: 'Проект' },
    })

    const icon = wrapper.find('svg')
    expect(icon.attributes('style') || '').not.toContain('color:')
  })
})

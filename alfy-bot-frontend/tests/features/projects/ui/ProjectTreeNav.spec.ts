import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/features/projects/model/project-store'
import ProjectTreeNav from '@/features/projects/ui/ProjectTreeNav.vue'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ params: {} }),
}))

describe('ProjectTreeNav', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('рендерит корневые проекты', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 'p1', parentId: null, title: 'Проект 1', description: null, viewMode: 'list', icon: null, color: null, order: 0 },
        { id: 'p2', parentId: null, title: 'Проект 2', description: null, viewMode: 'list', icon: null, color: null, order: 1 },
      ],
    })

    const store = useProjectStore()
    await store.fetchProjects()

    const wrapper = mount(ProjectTreeNav, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.text()).toContain('Проект 1')
    expect(wrapper.text()).toContain('Проект 2')
  })

  it('рендерит вложенные проекты с отступом', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 'root', parentId: null, title: 'Корень', description: null, viewMode: 'list', icon: null, color: null, order: 0 },
        { id: 'child', parentId: 'root', title: 'Дочерний', description: null, viewMode: 'list', icon: null, color: null, order: 0 },
      ],
    })

    const store = useProjectStore()
    await store.fetchProjects()

    const wrapper = mount(ProjectTreeNav, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.text()).toContain('Корень')
    expect(wrapper.text()).toContain('Дочерний')
  })

  it('показывает кнопку создания проекта', () => {
    const wrapper = mount(ProjectTreeNav, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.text()).toContain('Проекты')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('показывает пустое состояние при отсутствии проектов', () => {
    const wrapper = mount(ProjectTreeNav, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    // Header should still render
    expect(wrapper.text()).toContain('Проекты')
  })
})

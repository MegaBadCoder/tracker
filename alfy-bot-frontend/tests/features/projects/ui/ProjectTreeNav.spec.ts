import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/features/projects/model/project-store'
import ProjectTreeNav from '@/features/projects/ui/ProjectTreeNav.vue'
import { api } from '@/api/client'
import ProjectTreeList from '@/features/projects/ui/ProjectTreeList.vue'
import ProjectTreeItem from '@/features/projects/ui/ProjectTreeItem.vue'
import ProjectCreateDialog from '@/features/projects/ui/ProjectCreateDialog.vue'
import { useConfirm } from '@/composables/useConfirm'

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
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ProjectTreeNav', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('рендерит корневые проекты', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 'p1', parentId: null, title: 'Проект 1', description: null, viewMode: 'list', type: 'simple', icon: null, color: null, order: 0 },
        { id: 'p2', parentId: null, title: 'Проект 2', description: null, viewMode: 'list', type: 'simple', icon: null, color: null, order: 1 },
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
        { id: 'root', parentId: null, title: 'Корень', description: null, viewMode: 'list', type: 'simple', icon: null, color: null, order: 0 },
        { id: 'child', parentId: 'root', title: 'Дочерний', description: null, viewMode: 'list', type: 'simple', icon: null, color: null, order: 0 },
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


describe('действия дерева', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function setup() {
    const store = useProjectStore()
    store.projects = ['root', 'child', 'other'].map((id, index) => ({
      id, parentId: id === 'child' ? 'root' : null, title: id,
      description: null, viewMode: 'list', icon: null, color: null, order: index,
    }))
    return { store, wrapper: mount(ProjectTreeNav) }
  }

  it('сворачивает и раскрывает детей без удаления данных', async () => {
    const { store, wrapper } = setup()
    await wrapper.get('[aria-label="Свернуть root"]').trigger('click')
    expect(wrapper.text()).not.toContain('child')
    expect(store.projects).toHaveLength(3)
    await wrapper.get('[aria-label="Развернуть root"]').trigger('click')
    expect(wrapper.text()).toContain('child')
    wrapper.unmount()
  })

  it('передаёт родителя в создание подпроекта', async () => {
    const { wrapper } = setup()
    wrapper.findComponent(ProjectTreeItem).vm.$emit('createChild', { id: 'root' })
    await flushPromises()
    expect(wrapper.findComponent(ProjectCreateDialog).props()).toMatchObject({ open: true, parentId: 'root' })
    wrapper.unmount()
  })

  it('перемещает проект через единый запрос дерева', async () => {
    const { wrapper, store } = setup()
    vi.mocked(api.patch).mockResolvedValue({ data: store.projects.map(p => p.id === 'other' ? { ...p, parentId: 'root' } : p) })
    wrapper.findComponent(ProjectTreeList).vm.$emit('relocate', 'other', 'root', null)
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/projects/other/move', { parentId: 'root', beforeId: null })
    expect(store.projectMap.get('other')?.parentId).toBe('root')
    wrapper.unmount()
  })

  it('меню сортирует соседей без смены родителя', async () => {
    const { wrapper, store } = setup()
    vi.mocked(api.patch).mockResolvedValue({})
    wrapper.findComponent(ProjectTreeItem).vm.$emit('move', 1)
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/projects/reorder', { orderedIds: ['other', 'root'] })
    expect(store.projectTree.map(p => p.id)).toEqual(['other', 'root'])
    wrapper.unmount()
  })

  it('показывает ошибку сортировки и возвращает прежний порядок', async () => {
    const { wrapper, store } = setup()
    vi.mocked(api.patch).mockRejectedValue(new Error('offline'))
    wrapper.findComponent(ProjectTreeList).vm.$emit('reorder', ['other', 'root'])
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить порядок')
    expect(store.projectTree.map(p => p.id)).toEqual(['root', 'other'])
    wrapper.unmount()
  })

  it('отмена подтверждения не удаляет проект', async () => {
    const { wrapper, store } = setup()
    wrapper.findComponent(ProjectTreeItem).vm.$emit('delete', store.projectTree[0])
    useConfirm().handleCancel()
    await flushPromises()
    expect(api.delete).not.toHaveBeenCalled()
    expect(store.projects).toHaveLength(3)
    wrapper.unmount()
  })
  it('ошибка переноса сохраняет дерево и показывает сообщение', async () => {
    const { wrapper, store } = setup()
    const original = JSON.parse(JSON.stringify(store.projects))
    vi.mocked(api.patch).mockRejectedValue(new Error('offline'))
    wrapper.findComponent(ProjectTreeList).vm.$emit('relocate', 'other', 'root', null)
    await flushPromises()
    expect(store.projects).toEqual(original)
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось переместить проект')
    expect(store.treeBusy).toBe(false)
    wrapper.unmount()
  })

})

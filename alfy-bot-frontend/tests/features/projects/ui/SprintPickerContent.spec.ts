import type { Sprint } from '@/features/projects/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import SprintPickerContent from '@/features/projects/ui/SprintPickerContent.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planned',
    completedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function seed() {
  const store = useSprintStore()
  store.lists['proj-1'] = [
    makeSprint({ id: 'closed', name: 'Спринт 1', status: 'closed', order: 0 }),
    makeSprint({ id: 'planned-b', name: 'Спринт 4', status: 'planned', order: 3 }),
    makeSprint({ id: 'active', name: 'Спринт 2', status: 'active', order: 1 }),
    makeSprint({ id: 'planned-a', name: 'Спринт 3', status: 'planned', order: 2 }),
  ]
}

describe('sprintPickerContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seed()
  })

  it('показывает «Бэклог», активный и запланированные спринты по порядку', () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    const labels = wrapper.findAll('button').map(b => b.text())
    expect(labels).toEqual(['Бэклог', 'Спринт 2', 'Спринт 3', 'Спринт 4'])
  })

  it('не предлагает закрытые спринты', () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    expect(wrapper.text()).not.toContain('Спринт 1')
  })

  it('отмечает текущий спринт', () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: 'planned-a' } })

    const checked = wrapper.findAll('button').filter(b => b.find('svg.text-primary.ml-auto').exists())
    expect(checked.map(b => b.text())).toEqual(['Спринт 3'])
  })

  it('отмечает «Бэклог» для задачи без спринта', () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    const checked = wrapper.findAll('button').filter(b => b.find('svg.text-primary.ml-auto').exists())
    expect(checked.map(b => b.text())).toEqual(['Бэклог'])
  })

  it('для задачи в закрытом спринте ничего не отмечено', () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: 'closed' } })

    expect(wrapper.find('svg.text-primary.ml-auto').exists()).toBe(false)
  })

  it('выбор спринта эмитит его id, «Бэклог» — null', async () => {
    const wrapper = mount(SprintPickerContent, { props: { projectId: 'proj-1', modelValue: 'active' } })

    const buttons = wrapper.findAll('button')
    await buttons[2]!.trigger('click')
    await buttons[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['planned-a'], [null]])
  })
})

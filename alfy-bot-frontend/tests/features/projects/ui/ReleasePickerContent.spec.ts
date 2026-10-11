import type { Release } from '@/features/projects/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReleaseStore } from '@/features/projects/model/release-store'
import ReleasePickerContent from '@/features/projects/ui/ReleasePickerContent.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'v1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned',
    releasedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function seed() {
  useReleaseStore().lists['proj-1'] = [
    makeRelease({ id: 'released', name: 'v0.9', status: 'released', releasedAt: '2026-02-01T00:00:00.000Z', order: 0 }),
    makeRelease({ id: 'planned-b', name: 'v2.0', order: 2 }),
    makeRelease({ id: 'planned-a', name: 'v1.0', order: 1 }),
  ]
}

function checkedLabels(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('button').filter(b => b.find('svg.text-primary.ml-auto').exists()).map(b => b.text())
}

describe('releasePickerContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seed()
  })

  it('показывает «Без релиза» и запланированные релизы по порядку', () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    expect(wrapper.findAll('button').map(b => b.text())).toEqual(['Без релиза', 'v1.0', 'v2.0'])
  })

  it('не предлагает выпущенные релизы', () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    expect(wrapper.text()).not.toContain('v0.9')
  })

  it('отмечает текущий релиз', () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: 'planned-b' } })

    expect(checkedLabels(wrapper)).toEqual(['v2.0'])
  })

  it('отмечает «Без релиза» для задачи без релиза', () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: null } })

    expect(checkedLabels(wrapper)).toEqual(['Без релиза'])
  })

  it('для задачи в выпущенном релизе ничего не отмечено', () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: 'released' } })

    expect(wrapper.find('svg.text-primary.ml-auto').exists()).toBe(false)
  })

  it('выбор релиза эмитит его id, «Без релиза» — null', async () => {
    const wrapper = mount(ReleasePickerContent, { props: { projectId: 'proj-1', modelValue: 'planned-a' } })

    const buttons = wrapper.findAll('button')
    await buttons[2]!.trigger('click')
    await buttons[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['planned-b'], [null]])
  })
})

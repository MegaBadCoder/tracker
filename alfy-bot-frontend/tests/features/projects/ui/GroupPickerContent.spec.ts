import type { BoardGroupNode } from '@/features/projects/model/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGroupStore } from '@/features/projects/model/group-store'
import GroupPickerContent from '@/features/projects/ui/GroupPickerContent.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'epic-1',
    projectId: 'proj-1',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

describe('groupPickerContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('рендерит «Без эпика», эпики и вложенные истории', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История 1' })
    const groupStore = useGroupStore()
    groupStore.trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Эпик 1', children: [story] })]

    const wrapper = mount(GroupPickerContent, {
      props: { projectId: 'proj-1', modelValue: null },
    })

    const text = wrapper.text()
    expect(text).toContain('Без эпика')
    expect(text).toContain('Эпик 1')
    expect(text).toContain('История 1')
  })

  it('отмечает текущую выбранную группу', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История 1' })
    const groupStore = useGroupStore()
    groupStore.trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Эпик 1', children: [story] })]

    const wrapper = mount(GroupPickerContent, {
      props: { projectId: 'proj-1', modelValue: 'story-1' },
    })

    const buttons = wrapper.findAll('button')
    const storyButton = buttons.find(b => b.text().includes('История 1'))
    expect(storyButton?.find('svg.lucide-check').exists()).toBe(true)
  })

  it('эмитит выбор эпика и истории', async () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История 1' })
    const groupStore = useGroupStore()
    groupStore.trees['proj-1'] = [makeGroup({ id: 'epic-1', title: 'Эпик 1', children: [story] })]

    const wrapper = mount(GroupPickerContent, {
      props: { projectId: 'proj-1', modelValue: null },
    })

    const buttons = wrapper.findAll('button')
    await buttons.find(b => b.text().includes('Эпик 1'))!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['epic-1'])

    await buttons.find(b => b.text().includes('История 1'))!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['story-1'])

    await buttons.find(b => b.text().includes('Без эпика'))!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual([null])
  })
})

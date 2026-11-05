import type { BoardGroupNode } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { useGroupStore } from '@/features/projects/model/group-store'
import StoryPlanningFields from '@/features/projects/ui/StoryPlanningFields.vue'

beforeEach(() => setActivePinia(createPinia()))

it('поиск оставляет выбранные и удалённые зависимости доступными и сохраняет их только по кнопке', async () => {
  const story = { id: 'current', projectId: 'project', dependencyIds: ['selected', 'missing'], type: 'story' } as BoardGroupNode
  const groups = useGroupStore()
  groups.trees.project = [{ id: 'epic', children: [story, { id: 'selected', title: 'Выбранная история' }, { id: 'match', title: 'Искомая история' }, { id: 'other', title: 'Другая история' }] }] as BoardGroupNode[]
  const update = vi.spyOn(groups, 'updateGroup').mockResolvedValue(undefined)
  const wrapper = mount(StoryPlanningFields, { props: { story }, global: { stubs: { StoryStatusPicker: true } } })
  const search = wrapper.find('input[aria-label="Поиск зависимостей"]')
  expect(search.exists()).toBe(true)
  await search.setValue('Искомая')
  expect(wrapper.text()).toContain('Выбранная история')
  expect(wrapper.text()).toContain('История удалена')
  expect(wrapper.text()).toContain('Искомая история')
  expect(wrapper.text()).not.toContain('Другая история')
  expect(update).not.toHaveBeenCalled()
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(update).toHaveBeenCalledWith('project', 'current', expect.objectContaining({ dependencyIds: ['selected', 'missing'] }))
  wrapper.unmount()
})

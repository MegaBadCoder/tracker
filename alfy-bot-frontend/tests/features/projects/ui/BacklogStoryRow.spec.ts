import type { BacklogStory } from '@/features/projects/lib/backlog-stories'
import type { Sprint } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import draggable from 'vuedraggable'
import { useReleaseStore } from '@/features/projects/model/release-store'
import BacklogStoryRow from '@/features/projects/ui/BacklogStoryRow.vue'
import ReleasePickerContent from '@/features/projects/ui/ReleasePickerContent.vue'

const entry = {
  story: { id: 'story', projectId: 'project', parentId: 'epic', type: 'story', title: 'Оплата', releaseId: null },
  epic: { id: 'epic', title: 'Платежи' },
  tasks: [{ id: 'task', title: 'Форма', projectId: 'project', groupId: 'story', completed: false }],
  done: 0,
  total: 1,
} as BacklogStory

const mountRow = () => mount(BacklogStoryRow, { props: { entry, sprintId: 's1', sprints: [] }, attachTo: document.body })
const sprint = { id: 's2', name: 'Спринт 2', status: 'planned' } as Sprint

describe('строка истории', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('раскрывает задачи и создаёт задачу в своей истории', async () => {
    const row = mountRow()
    expect(row.find('[data-task-id]').exists()).toBe(false)
    await row.get('button[aria-label="Добавить задачу в историю Оплата"]').trigger('click')
    expect(row.find('[data-task-id="task"]').exists()).toBe(true)
    await row.get('input[placeholder="Название задачи в истории"]').setValue('Проверка оплаты')
    await row.get('input[placeholder="Название задачи в истории"]').trigger('keydown.enter')
    expect(row.emitted('createTask')).toEqual([['story', 'Проверка оплаты']])
    row.unmount()
  })

  it('drop в свою историю изменяет только спринт задачи', async () => {
    const row = mountRow()
    await row.get('button[aria-expanded]').trigger('click')
    row.getComponent(draggable).vm.$emit('change', { added: { element: { id: 'foreign-task', groupId: 'story' } } })
    expect(row.emitted('moveTask')).toEqual([['foreign-task', 's1']])
    row.unmount()
  })

  it('отклоняет drop в чужую историю', async () => {
    const row = mountRow()
    await row.get('button[aria-expanded]').trigger('click')
    const list = row.getComponent(draggable)
    const put = (list.vm.$attrs.group as { put: (target: unknown, source: unknown) => boolean }).put
    expect(put({}, { el: { closest: () => ({ dataset: { storyId: 'other-story' } }) } })).toBe(false)
    expect(put({}, { el: { closest: () => ({ dataset: { storyId: 'story' } }) } })).toBe(true)
    list.vm.$emit('change', { added: { element: { id: 'foreign-task', groupId: 'other-story' } } })
    expect(row.emitted('moveTask')).toBeUndefined()
    row.unmount()
  })

  it('ошибка назначения релиза видна пользователю', async () => {
    const store = useReleaseStore()
    vi.spyOn(store, 'setStoryRelease').mockRejectedValue(new Error('Не удалось сохранить'))
    const row = mountRow()
    await row.get('button[aria-label="Релиз истории Оплата"]').trigger('click')
    await flushPromises()
    row.getComponent(ReleasePickerContent).vm.$emit('update:modelValue', 'rel')
    await flushPromises()
    expect(store.setStoryRelease).toHaveBeenCalledWith('project', 'story', 'rel')
    expect(row.get('[role="alert"]').text()).toBe('Не удалось сохранить')
    row.unmount()
  })

  it('меню переноса эмитит назначение всей истории в спринт и бэклог', async () => {
    const row = mount(BacklogStoryRow, { props: { entry, sprintId: 's1', sprints: [sprint] }, attachTo: document.body })
    await row.get('button[aria-label="Перенести историю Оплата"]').trigger('click')
    await flushPromises()
    const items = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    items.find(el => el.textContent?.includes('Спринт 2'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(row.emitted('moveStory')).toEqual([['story', 's2']])
    await row.get('button[aria-label="Перенести историю Оплата"]').trigger('click')
    await flushPromises()
    const backlogItem = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]')).find(el => el.textContent?.includes('В бэклог'))!
    backlogItem.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(row.emitted('moveStory')).toEqual([['story', 's2'], ['story', null]])
    row.unmount()
  })
})

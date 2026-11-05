import type { BoardGroupNode } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useGroupStore } from '@/features/projects/model/group-store'
import GroupDetailContent from '@/features/projects/ui/GroupDetailContent.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

const projectId = 'a0000000-0000-4000-8000-000000000001'
const epicId = 'a0000000-0000-4000-8000-000000000002'
const storyId = 'a0000000-0000-4000-8000-000000000003'
const taskId = 'a0000000-0000-4000-8000-000000000004'

beforeEach(() => setActivePinia(createPinia()))

async function setup() {
  const story = { id: storyId, projectId, title: 'История', type: 'story', parentId: epicId, children: [] }
  useGroupStore().trees[projectId] = [{ id: epicId, projectId, title: 'Эпик', type: 'epic', color: null, children: [story] }] as BoardGroupNode[]
  useTaskStore().tasks = [{ id: taskId, projectId, title: 'Задача', completed: false, groupId: epicId }]
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/')
  const wrapper = mount(GroupDetailContent, { props: { projectId, groupId: epicId, presentation: 'page' }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

it('полная страница содержит настоящие ссылки на истории, задачи и проект без диалога', async () => {
  const wrapper = await setup()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(wrapper.get(`a[href="/tasks/project/${projectId}/group/${storyId}"]`).text()).toContain('История')
  expect(wrapper.get(`a[href="/tasks/${taskId}"]`).text()).toContain('Задача')
  expect(wrapper.find(`a[href="/tasks/project/${projectId}"]`).exists()).toBe(true)
  expect(wrapper.get('[aria-label="Название группы"]').text()).toBe('Эпик')
  wrapper.unmount()
})

it('ошибка сохранения названия доступна пользователю', async () => {
  const wrapper = await setup()
  vi.spyOn(useGroupStore(), 'updateGroup').mockRejectedValue(new Error('Сеть недоступна'))
  const title = wrapper.get('[aria-label="Название группы"]')
  title.element.textContent = 'Новое имя'
  await title.trigger('input')
  await title.trigger('blur')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Сеть недоступна')
  wrapper.unmount()
})

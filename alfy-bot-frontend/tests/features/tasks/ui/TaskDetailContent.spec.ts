import type { mount } from '@vue/test-utils'
import type { BoardGroupNode, Project } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import TaskDetailContent from '@/features/tasks/ui/TaskDetailContent.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'

vi.mock('@/api/client', () => ({ api: { get: vi.fn().mockResolvedValue({ data: [] }) } }))
vi.mock('@/api/goals', () => ({ fetchGoals: vi.fn().mockResolvedValue([]) }))

const taskId = '00000000-0000-4000-8000-000000000001'
const projectId = '00000000-0000-4000-8000-000000000002'
const epicId = '00000000-0000-4000-8000-000000000003'
const storyId = '00000000-0000-4000-8000-000000000004'
const task = { id: taskId, title: 'Задача', description: 'Описание', completed: false, projectId: null, checklist: { items: [{ id: 'item', text: 'Пункт', completed: false, order: 0 }] }, isPomodoroTask: true } as Task
const wrappers: ReturnType<typeof mount>[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  useGroupDetail().close()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function render(presentation: 'page' | 'preview', overrides: Partial<Task> = {}) {
  const wrapper = shallowMount(TaskDetailContent, {
    props: { task: { ...task, ...overrides }, open: true, presentation },
    global: { stubs: { ContentEditableInput: false, Button: false } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe.each(['page', 'preview'] as const)('taskDetailContent — %s', (presentation) => {
  it('emits the same title, description, checklist and pomodoro edits', async () => {
    const wrapper = render(presentation)
    await flushPromises()
    const title = wrapper.get('[aria-label="Название задачи"]')
    title.element.textContent = 'Новое название'
    await title.trigger('input')
    await title.trigger('blur')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({ id: taskId, title: 'Новое название' })
    wrapper.getComponent({ name: 'TaskDescription' }).vm.$emit('save', 'Новое описание')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({ id: taskId, description: 'Новое описание' })
    await wrapper.get('input[placeholder="Добавить пункт..."]').setValue('Второй пункт')
    await wrapper.get('input[placeholder="Добавить пункт..."]').trigger('keydown.enter')
    expect(wrapper.emitted('update:checklist')?.at(-1)?.[1]).toEqual(expect.arrayContaining([expect.objectContaining({ text: 'Второй пункт' })]))
    wrapper.getComponent({ name: 'PomodoroSettings' }).vm.$emit('update:count', 5)
    wrapper.getComponent({ name: 'PomodoroSettings' }).vm.$emit('blur')
    expect(wrapper.emitted('update:pomodoroConfig')?.at(-1)).toEqual([taskId, expect.objectContaining({ pomodoroCount: 5 })])
  })

  it('keeps frozen tasks read-only', async () => {
    const wrapper = render(presentation, { isOverdue: true })
    await flushPromises()
    expect(wrapper.get('[aria-label="Название задачи"]').attributes('contenteditable')).toBe('false')
    expect(wrapper.getComponent({ name: 'TaskDescription' }).props('editable')).toBe(false)
    expect(wrapper.getComponent({ name: 'PomodoroSettings' }).props('editable')).toBe(false)
    expect(wrapper.find('input[placeholder="Добавить пункт..."]').exists()).toBe(false)
  })
})

it('uses real project, epic and story links on the page without opening a preview', async () => {
  useProjectStore().projects = [{ id: projectId, title: 'Проект', type: 'agile' } as Project]
  useGroupStore().trees[projectId] = [{ id: epicId, projectId, title: 'Эпик', type: 'epic', parentId: null, children: [{ id: storyId, projectId, title: 'История', type: 'story', parentId: epicId, children: [] }] } as BoardGroupNode]
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tasks', name: 'tasks', component: { template: '<div />' } },
      { path: '/tasks/project/:projectId', name: 'tasks-project', component: { template: '<div />' } },
      { path: '/tasks/project/:projectId/group/:groupId', name: 'project-group', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  const wrapper = shallowMount(TaskDetailContent, { props: { task: { ...task, projectId, groupId: storyId }, open: true, presentation: 'page' }, global: { plugins: [router], stubs: { RouterLink: false } } })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get(`a[href="/tasks/project/${projectId}"]`).text()).toBe('Проект')
  expect(wrapper.get('a[aria-label="Открыть эпик"]').attributes('href')).toBe(`/tasks/project/${projectId}/group/${epicId}`)
  const story = wrapper.get('a[aria-label="Открыть историю"]')
  expect(story.attributes('href')).toBe(`/tasks/project/${projectId}/group/${storyId}`)
  await story.trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.params.groupId).toBe(storyId)
  expect(useGroupDetail().current.value).toBeNull()
  expect(wrapper.find('[aria-label="Закрыть быстрый просмотр"]').exists()).toBe(false)
  expect(wrapper.findComponent(TaskDetailDialog).exists()).toBe(false)
})

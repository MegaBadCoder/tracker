import type { BoardGroupNode } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useConfirm } from '@/composables/useConfirm'
import * as groupsApi from '@/features/projects/api/groups-api'
import * as projectsApi from '@/features/projects/api/projects-api'
import * as releasesApi from '@/features/projects/api/releases-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import GroupDetailContent from '@/features/projects/ui/GroupDetailContent.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import GroupView from '@/views/GroupView.vue'

vi.mock('@/features/projects/api/groups-api', () => ({ fetchGroups: vi.fn() }))
vi.mock('@/features/projects/api/projects-api', () => ({ fetchProject: vi.fn() }))
vi.mock('@/features/projects/api/releases-api', () => ({ fetchReleases: vi.fn() }))
const projectId = 'a0000000-0000-4000-8000-000000000001'
const groupId = 'a0000000-0000-4000-8000-000000000002'
const otherId = 'a0000000-0000-4000-8000-000000000003'
const epic = { id: groupId, projectId, title: 'Прямой вход', type: 'epic', color: null, children: [] } as unknown as BoardGroupNode

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(projectsApi.fetchProject).mockResolvedValue({ data: { id: projectId, title: 'Проект' } } as any)
  vi.mocked(releasesApi.fetchReleases).mockResolvedValue({ data: [] } as any)
  vi.spyOn(useTaskStore(), 'fetchTasks').mockResolvedValue(undefined)
})

async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tasks/project/:projectId/group/:groupId', component: GroupView }, { path: '/tasks/project/:projectId', component: { template: '<div>Проект</div>' } }] })
  await router.push(`/tasks/project/${projectId}/group/${groupId}`)
  const wrapper = mount(GroupView, { global: { plugins: [router], stubs: { TaskDetailDialog: true } } })
  await flushPromises()
  return { wrapper, router }
}

it('открывает редактор холодной ссылкой и загружает данные проекта', async () => {
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [epic] } as any)
  const { wrapper } = await setup()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Название группы"]').exists()).toBe(true)
  expect(wrapper.text()).toContain('Прямой вход')
  expect(useTaskStore().fetchTasks).toHaveBeenCalled()
  expect(releasesApi.fetchReleases).toHaveBeenCalledWith(projectId)
  wrapper.unmount()
})

it('ошибка сети не маскируется отсутствием группы; повторная загрузка восстанавливает страницу', async () => {
  vi.mocked(groupsApi.fetchGroups).mockRejectedValueOnce(new Error('Нет сети')).mockResolvedValueOnce({ data: [epic] } as any)
  const { wrapper } = await setup()
  expect(wrapper.text()).not.toContain('Группа не найдена')
  expect(wrapper.get('[role="alert"]').text()).toContain('Нет сети')
  await wrapper.findAll('button').find(button => button.text() === 'Повторить')!.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Прямой вход')
  wrapper.unmount()
})

it('показывает отсутствие группы после успешной загрузки', async () => {
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [] } as any)
  const { wrapper } = await setup()
  expect(wrapper.text()).toContain('Группа не найдена')
  wrapper.unmount()
})

it('устаревший ответ не подменяет новую группу после перехода', async () => {
  let resolveOld!: (value: any) => void
  vi.mocked(groupsApi.fetchGroups).mockReturnValueOnce(new Promise((resolve) => {
    resolveOld = resolve
  }))
  const { wrapper, router } = await setup()
  vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [{ ...epic, id: otherId, title: 'Новая группа' }] } as any)
  await router.push(`/tasks/project/${projectId}/group/${otherId}`)
  await flushPromises()
  expect(wrapper.text()).toContain('Новая группа')
  resolveOld({ data: [epic] })
  await flushPromises()
  expect(wrapper.text()).toContain('Новая группа')
  expect(useGroupStore().groupsOf(projectId)[0]?.id).toBe(otherId)
  wrapper.unmount()
})

it('ошибка подтверждённого удаления видна на странице, отмена не показывает ошибку', async () => {
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [epic] } as any)
  const { wrapper, router } = await setup()
  const remove = vi.spyOn(useGroupStore(), 'deleteGroup').mockRejectedValue(new Error('Не удалось удалить'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  wrapper.getComponent(GroupDetailContent).vm.$emit('delete')
  await flushPromises()
  useConfirm().handleCancel()
  await flushPromises()
  expect(remove).not.toHaveBeenCalled()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  wrapper.getComponent(GroupDetailContent).vm.$emit('delete')
  await flushPromises()
  useConfirm().handleConfirm()
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось удалить')
  expect(router.currentRoute.value.params.groupId).toBe(groupId)
  log.mockRestore()
  wrapper.unmount()
})

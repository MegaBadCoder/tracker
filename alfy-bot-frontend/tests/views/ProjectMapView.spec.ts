import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { api } from '@/api/client'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useTaskDependencyStore } from '@/features/tasks/model/task-dependency-store'
import { useTaskStore } from '@/features/tasks/model/task-store'
import ProjectMapView from '@/views/ProjectMapView.vue'

vi.mock('@/api/client', () => ({ api: { get: vi.fn() } }))
const projectId = 'project'
const sprint = { id: 'active', projectId, name: 'Текущий спринт', status: 'active', order: 1 }
let failPath = ''

function response(path: string) {
  if (path === failPath)
    return Promise.reject(new Error('Сеть недоступна'))
  if (path === '/tasks/dependencies/graph')
    return Promise.resolve({ data: [{ taskId: 'task', dependencyId: 'outside' }] })
  if (path === '/tasks')
    return Promise.resolve({ data: [{ id: 'task', title: 'Из спринта', projectId, sprintId: 'active', completed: false }, { id: 'outside', title: 'Внешняя', projectId: 'other', sprintId: 'next', completed: false }] })
  if (path.endsWith('/sprints'))
    return Promise.resolve({ data: [{ ...sprint, id: 'closed', name: 'Прошлый спринт', status: 'closed', order: 0, projectId: path.split('/')[2] }, { ...sprint, projectId: path.split('/')[2] }] })
  if (path.endsWith('/story-workflow'))
    return Promise.resolve({ data: { statuses: [] } })
  if (/\/projects\/[^/]+$/.test(path))
    return Promise.resolve({ data: { id: path.split('/').pop(), title: 'Музыка', type: 'agile' } })
  return Promise.resolve({ data: [] })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  failPath = ''
  vi.mocked(api.get).mockImplementation(response)
})

async function setup(query = '') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/tasks/project/:projectId/map', name: 'tasks-project-map', component: ProjectMapView },
    ...['tasks-project', 'tasks-project-backlog', 'tasks-project-releases'].map((name, i) => ({ path: `/tasks/project/:projectId/${i}`, name, component: { template: '<div />' } })),
  ] })
  await router.push(`/tasks/project/${projectId}/map${query}`)
  const wrapper = mount(ProjectMapView, { global: { plugins: [router], stubs: {
    SprintMapCanvas: { name: 'SprintMapCanvas', props: ['root', 'readonly', 'tasks', 'dependencies'], template: '<div data-testid="canvas">{{ root.title }}:{{ root.total }}<span v-if="readonly">Просмотр</span></div>' },
    SprintMapCreateDialog: true,
    TaskDetailDialog: true,
  } } })
  await flushPromises()
  return { wrapper, router }
}

it('холодный вход загружает состав и выбирает активный спринт', async () => {
  const { wrapper } = await setup()
  expect(wrapper.get('[data-testid="canvas"]').text()).toContain('Текущий спринт:1')
  expect(api.get).toHaveBeenCalledWith('/projects/project/groups')
  expect(api.get).toHaveBeenCalledWith('/tasks')
  wrapper.unmount()
})

it('ссылка на закрытый спринт показывает его состав и запрещает создание', async () => {
  const { wrapper } = await setup('?sprint=closed')
  expect(wrapper.get('[data-testid="canvas"]').text()).toContain('Прошлый спринт:0Просмотр')
  wrapper.unmount()
})

it('не подменяет отсутствующий спринт активным', async () => {
  const { wrapper } = await setup('?sprint=missing')
  expect(wrapper.text()).toContain('Спринт не найден')
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(false)
  wrapper.unmount()
})

it('отказ одного запроса не сохраняет частичный снимок; повтор восстанавливает карту', async () => {
  failPath = '/projects/project/releases'
  const { wrapper } = await setup()
  expect(wrapper.get('[role="alert"]').text()).toContain('Сеть недоступна')
  expect(useTaskStore().tasks).toEqual([])
  expect(useGroupStore().trees).toEqual({})
  failPath = ''
  await wrapper.findAll('button').find(button => button.text() === 'Повторить')!.trigger('click')
  await flushPromises()
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
  wrapper.unmount()
})

it('не применяет устаревший снимок после перехода в другой проект', async () => {
  let resolveOld!: (value: any) => void
  vi.mocked(api.get).mockImplementation((path: string) => path === '/projects/project/groups'
    ? new Promise((resolve) => { resolveOld = resolve })
    : response(path))
  const { wrapper, router } = await setup()
  await router.push('/tasks/project/other/map')
  await flushPromises()
  useTaskStore().tasks = [{ id: 'current', title: 'Актуальная задача', completed: false }]
  resolveOld({ data: [] })
  await flushPromises()
  expect(useTaskStore().tasks[0]?.id).toBe('current')
  expect(useGroupStore().trees.project).toBeUndefined()
  wrapper.unmount()
})

it('не применяет снимок после ухода со страницы', async () => {
  let resolveOld!: (value: any) => void
  vi.mocked(api.get).mockImplementation((path: string) => path === '/projects/project/groups'
    ? new Promise((resolve) => { resolveOld = resolve })
    : response(path))
  const { wrapper } = await setup()
  wrapper.unmount()
  resolveOld({ data: [] })
  await flushPromises()
  expect(useTaskStore().tasks).toEqual([])
  expect(useGroupStore().trees).toEqual({})
})

it('передаёт полный состав задач и граф, не увеличивая итоги спринта', async () => {
  const { wrapper } = await setup()
  expect(api.get).toHaveBeenCalledWith('/tasks/dependencies/graph')
  const canvas = wrapper.findComponent({ name: 'SprintMapCanvas' })
  expect(canvas.props('tasks')).toHaveLength(2)
  expect(canvas.props('dependencies')).toEqual([{ taskId: 'task', dependencyId: 'outside' }])
  expect(canvas.props('root').total).toBe(1)
  wrapper.unmount()
})

it('ошибка графа не выглядит отсутствием связей и не сохраняет частичный снимок', async () => {
  failPath = '/tasks/dependencies/graph'
  const { wrapper } = await setup()
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(false)
  expect(useTaskStore().tasks).toEqual([])
  expect(useTaskDependencyStore().loaded).toBe(false)
  failPath = ''
  await wrapper.findAll('button').find(button => button.text() === 'Повторить')!.trigger('click')
  await flushPromises()
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
  expect(useTaskDependencyStore().loaded).toBe(true)
  wrapper.unmount()
})

it('повторно получает граф, если его изменили за время загрузки карты', async () => {
  let resolveGraph!: (value: any) => void
  let requests = 0
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path !== '/tasks/dependencies/graph')
      return response(path)
    requests++
    return requests === 1
      ? new Promise((resolve) => {
          resolveGraph = resolve
        })
      : Promise.resolve({ data: [] })
  })
  const { wrapper } = await setup()
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(false)
  expect(useTaskStore().tasks).toEqual([])
  const dependencies = useTaskDependencyStore()
  dependencies.revision++
  dependencies.edges = []
  resolveGraph({ data: [{ taskId: 'task', dependencyId: 'outside' }] })
  await flushPromises()
  expect(dependencies.edges).toEqual([])
  expect(dependencies.loaded).toBe(true)
  expect(requests).toBe(2)
  expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
  wrapper.unmount()
})

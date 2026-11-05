import type { Task } from '@/features/tasks/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useTaskDependencyStore } from '@/features/tasks/model/task-dependency-store'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDependencies from '@/features/tasks/ui/TaskDependencies.vue'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const c = '00000000-0000-4000-8000-000000000003'
const task: Task = { id: a, title: 'Выпуск', completed: false, projectId: 'project', sprintId: 'sprint' }
const predecessor: Task = { id: b, title: 'Подготовка', completed: false, projectId: 'other', sprintId: 'other' }
const wrappers: ReturnType<typeof mount>[] = []

function render(editable = true) {
  const wrapper = mount(TaskDependencies, { props: { task, editable } })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(api.get).mockImplementation(async path => ({ data: path === '/tasks' ? [task, predecessor] : [{ taskId: a, dependencyId: b }] }))
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('на холодной странице загружает задачи, показывает ожидание, ссылку и внешний контекст', async () => {
  const wrapper = render()
  await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/tasks')
  expect(wrapper.text()).toContain('Ожидает: 1')
  expect(wrapper.get(`a[href="/tasks/${b}"]`).text()).toContain('Подготовка')
  expect(wrapper.text()).toContain('Другой проект')
  expect(wrapper.text()).toContain('Другой спринт')
  useTaskStore().tasks.find(item => item.id === b)!.completed = true
  await flushPromises()
  expect(wrapper.text()).toContain('Предшественники выполнены')
  expect(useTaskStore().tasks.find(item => item.id === a)?.completed).toBe(false)
  expect(api.put).not.toHaveBeenCalled()
})

it('сохраняет удаление явно, оставляет черновик после ошибки и повторяет запрос', async () => {
  const wrapper = render()
  await flushPromises()
  await wrapper.get('[aria-label="Изменить зависимости"]').trigger('click')
  await wrapper.get('[aria-label="Убрать предшественника Подготовка"]').trigger('click')
  expect(api.put).not.toHaveBeenCalled()
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Нет сети')).mockResolvedValueOnce({ data: { taskId: a, dependencyIds: [] } })
  await wrapper.get('[data-testid="save-dependencies"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Нет сети')
  expect(wrapper.find('[data-testid="save-dependencies"]').exists()).toBe(true)
  expect(useTaskDependencyStore().edges).toHaveLength(1)
  await wrapper.get('[data-testid="save-dependencies"]').trigger('click')
  await flushPromises()
  expect(api.put).toHaveBeenLastCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [] })
  expect(wrapper.text()).toContain('Нет предшественников')
  expect(wrapper.find('[data-testid="save-dependencies"]').exists()).toBe(false)
})

it('поиск исключает текущую и виртуальную задачу; добавление не меняет статус', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: [task, predecessor, { ...task, id: `${c}__virtual__123` }] }).mockResolvedValueOnce({ data: [] })
  const wrapper = render()
  await flushPromises()
  await wrapper.get('[aria-label="Изменить зависимости"]').trigger('click')
  await wrapper.get('input[aria-label="Найти предшественника"]').setValue('Подготовка')
  await wrapper.get('[aria-label="Добавить предшественника Подготовка"]').trigger('click')
  vi.mocked(api.put).mockResolvedValue({ data: { taskId: a, dependencyIds: [b] } })
  await wrapper.get('[data-testid="save-dependencies"]').trigger('click')
  await flushPromises()
  expect(api.put).toHaveBeenCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [b] })
  expect(useTaskStore().tasks.find(item => item.id === a)?.completed).toBe(false)
})

it('readonly и замороженная задача сохраняют ссылки без редактора', async () => {
  const wrapper = render(false)
  await flushPromises()
  expect(wrapper.find('[aria-label="Изменить зависимости"]').exists()).toBe(false)
  expect(wrapper.get(`a[href="/tasks/${b}"]`).exists()).toBe(true)
  await wrapper.setProps({ editable: true, task: { ...task, isOverdue: true } })
  expect(wrapper.find('[aria-label="Изменить зависимости"]').exists()).toBe(false)
})

it('ошибка загрузки не выдаётся за пустой граф, повтор восстанавливает редактор', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Загрузка недоступна'))
  const wrapper = render()
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Загрузка недоступна')
  expect(wrapper.text()).not.toContain('Нет предшественников')
  await wrapper.get('[aria-label="Повторить загрузку зависимостей"]').trigger('click')
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.text()).toContain('Ожидает: 1')
})

it('поздний ответ сохранения предыдущей задачи не закрывает новый черновик', async () => {
  const wrapper = render()
  await flushPromises()
  await wrapper.get('[aria-label="Изменить зависимости"]').trigger('click')
  let finish!: (value: unknown) => void
  vi.mocked(api.put).mockReturnValue(new Promise((resolve) => {
    finish = resolve
  }))
  await wrapper.get('[data-testid="save-dependencies"]').trigger('click')
  await wrapper.setProps({ task: { ...task, id: c, title: 'Новая' } })
  finish({ data: { taskId: a, dependencyIds: [b] } })
  await flushPromises()
  await wrapper.get('[aria-label="Изменить зависимости"]').trigger('click')
  await wrapper.get('[aria-label="Добавить предшественника Подготовка"]').trigger('click')
  expect(wrapper.find('[data-testid="save-dependencies"]').exists()).toBe(true)
  expect(wrapper.get('[aria-label="Убрать предшественника Подготовка"]').exists()).toBe(true)
})

it('снимок кандидатов не отменяет завершение задачи во время загрузки', async () => {
  useTaskStore().tasks = [task, { ...predecessor }]
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(path => path === '/tasks'
    ? new Promise((resolve) => { finish = resolve })
    : Promise.resolve({ data: [{ taskId: a, dependencyId: b }] }))
  const wrapper = render()
  useTaskStore().tasks.find(item => item.id === b)!.completed = true
  finish({ data: [task, predecessor] })
  await flushPromises()
  expect(wrapper.text()).toContain('Предшественники выполнены')
  expect(useTaskStore().tasks.find(item => item.id === b)?.completed).toBe(true)
})

it('удалённый предшественник исчезает из ожидания и ссылок', async () => {
  const wrapper = render()
  await flushPromises()
  useTaskStore().tasks = useTaskStore().tasks.filter(item => item.id !== b)
  await flushPromises()
  expect(wrapper.text()).not.toContain('Ожидает: 1')
  expect(wrapper.find(`a[href="/tasks/${b}"]`).exists()).toBe(false)
})

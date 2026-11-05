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
const another: Task = { ...predecessor, id: c, title: 'Проверка' }
const wrappers: ReturnType<typeof mount>[] = []

function render(editable = true) {
  const wrapper = mount(TaskDependencies, { props: { task, editable } })
  wrappers.push(wrapper)
  return wrapper
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(api.get).mockImplementation(async path => ({ data: path === '/tasks' ? [task, predecessor, another] : [{ taskId: a, dependencyId: b }] }))
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('на холодной странице показывает ссылки, внешний контекст и актуальное ожидание без изменения статуса', async () => {
  const wrapper = render()
  await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/tasks')
  expect(wrapper.text()).toContain('Незавершённых зависимостей: 1')
  expect(wrapper.get(`a[href="/tasks/${b}"]`).text()).toContain('Подготовка')
  expect(wrapper.text()).toContain('Другой проект')
  expect(wrapper.text()).toContain('Другой спринт')
  useTaskStore().tasks.find(item => item.id === b)!.completed = true
  await flushPromises()
  expect(wrapper.text()).toContain('Все зависимости выполнены')
  expect(useTaskStore().tasks.find(item => item.id === a)?.completed).toBe(false)
  expect(api.put).not.toHaveBeenCalled()
})

it('постоянное поле показывает результаты только после ввода и сразу сохраняет добавление', async () => {
  const wrapper = render()
  await flushPromises()
  expect(wrapper.find('[aria-label="Изменить зависимости"]').exists()).toBe(false)
  expect(wrapper.find('[data-testid="save-dependencies"]').exists()).toBe(false)
  const input = wrapper.get('input[aria-label="Поиск задач по названию"]')
  expect(input.attributes('placeholder')).toBe('Поиск задач по названию')
  expect(wrapper.find('[aria-label="Добавить предшественника Проверка"]').exists()).toBe(false)
  await input.setValue('Проверка')
  vi.mocked(api.put).mockResolvedValue({ data: { taskId: a, dependencyIds: [b, c] } })
  await wrapper.get('[aria-label="Добавить предшественника Проверка"]').trigger('click')
  expect(api.put).toHaveBeenCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [b, c] })
  await flushPromises()
  expect(wrapper.get(`a[href="/tasks/${c}"]`).text()).toBe('Проверка')
  expect(useTaskStore().tasks.find(item => item.id === a)?.completed).toBe(false)
})

it('крестик сразу удаляет зависимость без режима редактирования', async () => {
  const wrapper = render()
  await flushPromises()
  vi.mocked(api.put).mockResolvedValue({ data: { taskId: a, dependencyIds: [] } })
  await wrapper.get('[aria-label="Убрать предшественника Подготовка"]').trigger('click')
  expect(api.put).toHaveBeenCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [] })
  await flushPromises()
  expect(wrapper.text()).toContain('Зависимости не добавлены')
  expect(wrapper.find(`a[href="/tasks/${b}"]`).exists()).toBe(false)
})

it('ошибка удаления откатывает видимый набор, повтор сохраняет новые связи другой сессии', async () => {
  const wrapper = render()
  await flushPromises()
  const request = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValueOnce(request.promise).mockResolvedValueOnce({ data: { taskId: a, dependencyIds: [c] } })
  await wrapper.get('[aria-label="Убрать предшественника Подготовка"]').trigger('click')
  expect(wrapper.find(`a[href="/tasks/${b}"]`).exists()).toBe(false)
  expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  request.reject(new Error('Network Error'))
  await flushPromises()
  expect(wrapper.get(`a[href="/tasks/${b}"]`).exists()).toBe(true)
  expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить зависимости')
  expect(wrapper.text()).not.toContain('Network Error')
  useTaskDependencyStore().edges.push({ taskId: a, dependencyId: c })
  await wrapper.get('[aria-label="Повторить сохранение"]').trigger('click')
  await flushPromises()
  expect(api.put).toHaveBeenLastCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [c] })
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get(`a[href="/tasks/${c}"]`).exists()).toBe(true)
})

it('ошибка добавления восстанавливает сохранённый набор и повторяет добавление по текущему графу', async () => {
  vi.mocked(api.get).mockImplementation(async path => ({ data: path === '/tasks' ? [task, predecessor, another] : [] }))
  const wrapper = render()
  await flushPromises()
  await wrapper.get('input').setValue('Подготовка')
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Request failed with status code 503')).mockResolvedValueOnce({ data: { taskId: a, dependencyIds: [c, b] } })
  await wrapper.get('[aria-label="Добавить предшественника Подготовка"]').trigger('click')
  await flushPromises()
  expect(wrapper.find(`a[href="/tasks/${b}"]`).exists()).toBe(false)
  expect(wrapper.text()).toContain('Зависимости не добавлены')
  expect(wrapper.text()).not.toContain('Request failed')
  useTaskDependencyStore().edges.push({ taskId: a, dependencyId: c })
  await wrapper.get('[aria-label="Повторить сохранение"]').trigger('click')
  await flushPromises()
  expect(api.put).toHaveBeenLastCalledWith(`/tasks/${a}/dependencies`, { dependencyIds: [c, b] })
})

it('предметная ошибка сервера объясняет причину отказа', async () => {
  const wrapper = render()
  await flushPromises()
  await wrapper.get('input').setValue('Проверка')
  vi.mocked(api.put).mockRejectedValue({ response: { status: 400, data: { message: 'Зависимости образуют цикл' } } })
  await wrapper.get('[aria-label="Добавить предшественника Проверка"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Зависимости образуют цикл')
})

it('поиск исключает текущую, уже выбранную и виртуальную задачу', async () => {
  const wrapper = render()
  await flushPromises()
  useTaskStore().tasks.push({ ...another, id: `${c}__virtual__123`, title: 'Проверка виртуальная' })
  await wrapper.get('input').setValue('Выпуск')
  expect(wrapper.find('[aria-label="Добавить предшественника Выпуск"]').exists()).toBe(false)
  await wrapper.get('input').setValue('Подготовка')
  expect(wrapper.find('[aria-label="Добавить предшественника Подготовка"]').exists()).toBe(false)
  await wrapper.get('input').setValue('Проверка')
  expect(wrapper.find('[aria-label="Добавить предшественника Проверка виртуальная"]').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Добавить предшественника Проверка"]').exists()).toBe(true)
})

it('readonly и замороженная задача сохраняют ссылки без поля и крестиков', async () => {
  const wrapper = render(false)
  await flushPromises()
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Убрать предшественника Подготовка"]').exists()).toBe(false)
  expect(wrapper.get(`a[href="/tasks/${b}"]`).exists()).toBe(true)
  await wrapper.setProps({ editable: true, task: { ...task, isOverdue: true } })
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Убрать предшественника Подготовка"]').exists()).toBe(false)
})

it('ошибка загрузки отображается по-русски и повтор восстанавливает поле', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Error'))
  const wrapper = render()
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось загрузить зависимости')
  expect(wrapper.text()).not.toContain('Network Error')
  expect(wrapper.text()).not.toContain('Зависимости не добавлены')
  await wrapper.get('[aria-label="Повторить загрузку зависимостей"]').trigger('click')
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('input').exists()).toBe(true)
})

it('поздняя ошибка сохранения предыдущей задачи не переносит состояние в новую', async () => {
  const wrapper = render()
  await flushPromises()
  const request = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValue(request.promise)
  await wrapper.get('[aria-label="Убрать предшественника Подготовка"]').trigger('click')
  await wrapper.setProps({ task: another })
  request.reject(new Error('Network Error'))
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.find('[aria-label="Повторить сохранение"]').exists()).toBe(false)
  expect(wrapper.get('input').attributes('disabled')).toBeUndefined()
  expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  expect(wrapper.text()).toContain('Зависимости не добавлены')
})

it('после размонтирования ошибка запроса не создаёт незавершённых отклонений', async () => {
  const wrapper = render()
  await flushPromises()
  const request = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValue(request.promise)
  await wrapper.get('[aria-label="Убрать предшественника Подготовка"]').trigger('click')
  wrapper.unmount()
  request.reject(new Error('Network Error'))
  await flushPromises()
  expect(useTaskDependencyStore().edges).toEqual([{ taskId: a, dependencyId: b }])
})

it('снимок кандидатов не отменяет завершение задачи во время загрузки', async () => {
  useTaskStore().tasks = [task, { ...predecessor }]
  const request = deferred<{ data: Task[] }>()
  vi.mocked(api.get).mockImplementation(path => path === '/tasks'
    ? request.promise
    : Promise.resolve({ data: [{ taskId: a, dependencyId: b }] }))
  const wrapper = render()
  useTaskStore().tasks.find(item => item.id === b)!.completed = true
  request.resolve({ data: [task, predecessor] })
  await flushPromises()
  expect(wrapper.text()).toContain('Все зависимости выполнены')
  expect(useTaskStore().tasks.find(item => item.id === b)?.completed).toBe(true)
})

it('удалённый предшественник исчезает из ожидания и ссылок', async () => {
  const wrapper = render()
  await flushPromises()
  useTaskStore().tasks = useTaskStore().tasks.filter(item => item.id !== b)
  await flushPromises()
  expect(wrapper.text()).not.toContain('Незавершённых зависимостей: 1')
  expect(wrapper.find(`a[href="/tasks/${b}"]`).exists()).toBe(false)
})

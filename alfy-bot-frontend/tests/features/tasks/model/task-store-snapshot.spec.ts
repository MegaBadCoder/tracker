import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/api/client', () => ({ api: { get: vi.fn() } }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

it('снимок преобразует даты и настройки без изменения текущих задач и состояния загрузки', async () => {
  const store = useTaskStore()
  store.tasks = [{ id: 'current', title: 'Текущая', completed: false }]
  store.error = 'Предыдущая ошибка'
  vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'fresh', title: 'Новая', dueDate: '2026-11-05T08:00:00Z', pomodoroConfig: { pomodoroCount: 3 } }] })
  const snapshot = await store.fetchTaskSnapshot()
  expect(snapshot[0]?.dueDate).toBeInstanceOf(Date)
  expect(snapshot[0]?.pomodoroCount).toBe(3)
  expect(store.tasks[0]?.id).toBe('current')
  expect(store.error).toBe('Предыдущая ошибка')
  expect(store.loading).toBe(false)
})

it('ошибка снимка отклоняет запрос без изменения хранилища', async () => {
  const store = useTaskStore()
  store.tasks = [{ id: 'current', title: 'Текущая', completed: false }]
  vi.mocked(api.get).mockRejectedValue(new Error('Нет сети'))
  await expect(store.fetchTaskSnapshot()).rejects.toThrow('Нет сети')
  expect(store.tasks[0]?.id).toBe('current')
  expect(store.error).toBeNull()
})

it('обычная загрузка по-прежнему записывает преобразованные задачи в хранилище', async () => {
  const store = useTaskStore()
  vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'fresh', title: 'Новая', dueDate: '2026-11-05T08:00:00Z' }] })
  await store.fetchTasks()
  expect(store.tasks[0]?.id).toBe('fresh')
  expect(store.tasks[0]?.dueDate).toBeInstanceOf(Date)
  expect(store.loading).toBe(false)
})

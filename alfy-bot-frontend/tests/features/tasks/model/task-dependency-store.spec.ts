import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useTaskDependencyStore } from '@/features/tasks/model/task-dependency-store'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

it('загружает полный граф и сообщает об ошибке без потери последнего снимка', async () => {
  const store = useTaskDependencyStore()
  const edges = [{ taskId: 'a', dependencyId: 'b' }]
  vi.mocked(api.get).mockResolvedValueOnce({ data: edges }).mockRejectedValueOnce(new Error('Нет сети'))
  await store.fetchGraph()
  expect(store.edges).toEqual(edges)
  expect(store.loaded).toBe(true)
  await expect(store.fetchGraph()).rejects.toThrow('Нет сети')
  expect(store.edges).toEqual(edges)
  expect(store.error).toBe('Нет сети')
  expect(store.loading).toBe(false)
})

it('параллельные сохранения разных задач объединяются по каноническим ответам', async () => {
  const store = useTaskDependencyStore()
  store.applySnapshot([{ taskId: 'a', dependencyId: 'old' }], store.revision)
  const a = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  const b = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
  const saveA = store.replace('a', ['new'])
  const saveB = store.replace('b', ['other'])
  b.resolve({ data: { taskId: 'b', dependencyIds: ['other'] } })
  await saveB
  a.resolve({ data: { taskId: 'a', dependencyIds: ['canonical'] } })
  await saveA
  expect(store.edges).toEqual(expect.arrayContaining([{ taskId: 'a', dependencyId: 'canonical' }, { taskId: 'b', dependencyId: 'other' }]))
  expect(store.edges).toHaveLength(2)
})

it('снимок до или во время записи не может стереть сохранённые связи', async () => {
  const store = useTaskDependencyStore()
  const revision = store.revision
  const request = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValue(request.promise)
  const saving = store.replace('a', ['b'])
  expect(store.applySnapshot([], revision)).toBe(false)
  expect(store.applySnapshot([], store.revision)).toBe(false)
  const duringSave = store.revision
  request.resolve({ data: { taskId: 'a', dependencyIds: ['b'] } })
  await saving
  expect(store.applySnapshot([], revision)).toBe(false)
  expect(store.applySnapshot([], duringSave)).toBe(false)
  expect(store.edges).toEqual([{ taskId: 'a', dependencyId: 'b' }])
})

it('ошибка записи сохраняет связи и допускает повтор с удалением всех предшественников', async () => {
  const store = useTaskDependencyStore()
  store.applySnapshot([{ taskId: 'a', dependencyId: 'b' }], store.revision)
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Цикл')).mockResolvedValueOnce({ data: { taskId: 'a', dependencyIds: [] } })
  await expect(store.replace('a', [])).rejects.toThrow('Цикл')
  expect(store.edges).toHaveLength(1)
  await store.replace('a', [])
  expect(store.edges).toEqual([])
})

it('повторяет загрузку графа, если сохранение обогнало старый ответ', async () => {
  const store = useTaskDependencyStore()
  const stale = deferred<{ data: { taskId: string, dependencyId: string }[] }>()
  vi.mocked(api.get).mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ data: [{ taskId: 'a', dependencyId: 'b' }, { taskId: 'c', dependencyId: 'd' }] })
  const loading = store.fetchGraph()
  await Promise.resolve()
  vi.mocked(api.put).mockResolvedValue({ data: { taskId: 'a', dependencyIds: ['b'] } })
  await store.replace('a', ['b'])
  stale.resolve({ data: [] })
  await loading
  expect(store.edges).toHaveLength(2)
  expect(store.loaded).toBe(true)
  expect(api.get).toHaveBeenCalledTimes(2)
})

it('очередь одной задачи не отправляет второй запрос до завершения первого', async () => {
  const store = useTaskDependencyStore()
  const first = deferred<{ data: { taskId: string, dependencyIds: string[] } }>()
  vi.mocked(api.put).mockReturnValueOnce(first.promise).mockResolvedValueOnce({ data: { taskId: 'a', dependencyIds: ['c'] } })
  const saveFirst = store.replace('a', ['b'])
  const saveSecond = store.replace('a', ['c'])
  expect(api.put).toHaveBeenCalledTimes(1)
  first.resolve({ data: { taskId: 'a', dependencyIds: ['b'] } })
  await Promise.all([saveFirst, saveSecond])
  expect(store.edges).toEqual([{ taskId: 'a', dependencyId: 'c' }])
})

it('более старый GET не затирает новый полный снимок', async () => {
  const store = useTaskDependencyStore()
  const old = deferred<{ data: { taskId: string, dependencyId: string }[] }>()
  vi.mocked(api.get).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [{ taskId: 'a', dependencyId: 'b' }] })
  const first = store.fetchGraph()
  await Promise.resolve()
  await store.fetchGraph()
  old.resolve({ data: [] })
  await first
  expect(store.edges).toEqual([{ taskId: 'a', dependencyId: 'b' }])
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useColumnStore } from '@/features/projects/model/column-store'
import * as columnsApi from '@/features/projects/api/columns-api'
import type { ProjectColumn } from '@/features/projects/model/types'

vi.mock('@/features/projects/api/columns-api', () => ({
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}))

function makeColumn(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
  return {
    id: 'col-1',
    projectId: 'proj-1',
    title: 'В работе',
    order: 0,
    color: null,
    ...overrides,
  }
}

describe('useColumnStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── fetchColumns ────────────────────────────────────────────────

  describe('fetchColumns', () => {
    it('загружает колонки для проекта', async () => {
      const cols = [makeColumn(), makeColumn({ id: 'col-2', title: 'Готово', order: 1 })]
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: cols } as any)

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      expect(store.columns).toHaveLength(2)
      expect(store.currentProjectId).toBe('proj-1')
      expect(columnsApi.fetchColumns).toHaveBeenCalledWith('proj-1')
    })

    it('устанавливает loading', async () => {
      vi.mocked(columnsApi.fetchColumns).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] } as any), 100)),
      )

      const store = useColumnStore()
      const promise = store.fetchColumns('proj-1')

      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('устанавливает error при ошибке', async () => {
      vi.mocked(columnsApi.fetchColumns).mockRejectedValue(new Error('Ошибка сети'))

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      expect(store.error).toBe('Ошибка сети')
    })

    it('сбрасывает loading после ошибки', async () => {
      vi.mocked(columnsApi.fetchColumns).mockRejectedValue(new Error('Ошибка'))

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      expect(store.loading).toBe(false)
    })
  })

  // ── createColumn ────────────────────────────────────────────────

  describe('createColumn', () => {
    it('optimistic добавление с temp ID', async () => {
      vi.mocked(columnsApi.createColumn).mockImplementation(
        () => new Promise((resolve) =>
          setTimeout(() => resolve({ data: makeColumn({ id: 'real-id' }) } as any), 100),
        ),
      )

      const store = useColumnStore()
      const promise = store.createColumn('proj-1', { title: 'Новая' })

      expect(store.columns).toHaveLength(1)
      expect(store.columns[0].id).toMatch(/^temp-/)

      await promise
    })

    it('заменяет temp на реальный после ответа', async () => {
      const realColumn = makeColumn({ id: 'real-id', title: 'Новая' })
      vi.mocked(columnsApi.createColumn).mockResolvedValue({ data: realColumn } as any)

      const store = useColumnStore()
      await store.createColumn('proj-1', { title: 'Новая' })

      expect(store.columns).toHaveLength(1)
      expect(store.columns[0].id).toBe('real-id')
    })

    it('откатывает при ошибке API', async () => {
      vi.mocked(columnsApi.createColumn).mockRejectedValue(new Error('Ошибка'))

      const store = useColumnStore()

      await expect(store.createColumn('proj-1', { title: 'X' })).rejects.toThrow()

      expect(store.columns).toHaveLength(0)
    })
  })

  // ── updateColumn ────────────────────────────────────────────────

  describe('updateColumn', () => {
    it('optimistic обновление', async () => {
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [makeColumn()] } as any)
      vi.mocked(columnsApi.updateColumn).mockResolvedValue({
        data: makeColumn({ title: 'Обновлённая' }),
      } as any)

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await store.updateColumn('proj-1', 'col-1', { title: 'Обновлённая' })

      expect(store.columns[0].title).toBe('Обновлённая')
    })

    it('откатывает при ошибке', async () => {
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [makeColumn()] } as any)
      vi.mocked(columnsApi.updateColumn).mockRejectedValue(new Error('Ошибка'))

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await expect(
        store.updateColumn('proj-1', 'col-1', { title: 'X' }),
      ).rejects.toThrow()

      expect(store.columns[0].title).toBe('В работе')
    })
  })

  // ── deleteColumn ────────────────────────────────────────────────

  describe('deleteColumn', () => {
    it('optimistic удаление', async () => {
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [makeColumn()] } as any)
      vi.mocked(columnsApi.deleteColumn).mockResolvedValue({ data: undefined } as any)

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await store.deleteColumn('proj-1', 'col-1')

      expect(store.columns).toHaveLength(0)
    })

    it('откатывает при ошибке', async () => {
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [makeColumn()] } as any)
      vi.mocked(columnsApi.deleteColumn).mockRejectedValue(new Error('Ошибка'))

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await expect(store.deleteColumn('proj-1', 'col-1')).rejects.toThrow()

      expect(store.columns).toHaveLength(1)
    })
  })

  // ── reorderColumns ──────────────────────────────────────────────

  describe('reorderColumns', () => {
    it('обновляет order полей', async () => {
      const cols = [
        makeColumn({ id: 'col-1', order: 0 }),
        makeColumn({ id: 'col-2', order: 1 }),
      ]
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: cols } as any)
      vi.mocked(columnsApi.reorderColumns).mockResolvedValue({ data: undefined } as any)

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await store.reorderColumns('proj-1', ['col-2', 'col-1'])

      expect(store.columns[0].id).toBe('col-2')
      expect(store.columns[0].order).toBe(0)
      expect(store.columns[1].id).toBe('col-1')
      expect(store.columns[1].order).toBe(1)
    })

    it('откатывает при ошибке', async () => {
      const cols = [
        makeColumn({ id: 'col-1', order: 0 }),
        makeColumn({ id: 'col-2', order: 1 }),
      ]
      vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: cols } as any)
      vi.mocked(columnsApi.reorderColumns).mockRejectedValue(new Error('Ошибка'))

      const store = useColumnStore()
      await store.fetchColumns('proj-1')

      await expect(
        store.reorderColumns('proj-1', ['col-2', 'col-1']),
      ).rejects.toThrow()

      expect(store.columns[0].id).toBe('col-1')
    })
  })
})

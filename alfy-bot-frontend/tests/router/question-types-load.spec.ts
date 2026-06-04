import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// localStorage-полифилл: глубокие импорты view-компонентов могут к нему
// обращаться; в изолированном спеке happy-dom иногда не поднимает его сам.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
}

// Регрессия Critical-находки ревью: справочник типов вопросов должен грузиться
// на ЛЮБОМ входе в авторизованную часть (вкл. свежий логин через LoginView с
// SPA-навигацией). Единый чокпоинт — router guard.

const loadMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/question-types-store', () => ({
  useQuestionTypesStore: () => ({ load: loadMock }),
}))

const isAuthenticatedMock = vi.fn()
vi.mock('@/api/tokenStorage', () => ({
  isAuthenticated: () => isAuthenticatedMock(),
}))

// eslint-disable-next-line import/first -- router-импорт после vi.mock/полифилла намеренно
import router from '@/router'

describe('router guard — загрузка типов вопросов', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadMock.mockClear()
  })

  it('на авторизованном маршруте при наличии токена вызывает store.load()', async () => {
    isAuthenticatedMock.mockReturnValue(true)
    await router.push('/settings')
    await router.isReady()
    expect(loadMock).toHaveBeenCalled()
  })

  it('без токена редиректит на login и НЕ грузит типы', async () => {
    isAuthenticatedMock.mockReturnValue(false)
    await router.push('/habits').catch(() => {})
    expect(router.currentRoute.value.name).toBe('login')
    expect(loadMock).not.toHaveBeenCalled()
  })
})

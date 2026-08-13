import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useTimerStore } from '@/features/task-timer'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}))

vi.mock('@/composables/useSounds', () => ({
  useSounds: () => ({ play: vi.fn() }),
}))

describe('timer store restoreSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('сбрасывает локальный таймер, если на бэке сессии нет', async () => {
    const store = useTimerStore()
    store.initSession({
      pomodoroTime: 25,
      breakTime: 5,
      longBreakTime: 15,
      longBreakInterval: 4,
      countPomodoro: 10,
      taskId: 'task-1',
    })
    store.nextPhase()
    vi.mocked(api.get).mockResolvedValue({ data: null })

    await store.restoreSession()

    expect(store.phase).toBe(0)
    expect(store.isActive).toBe(false)
    expect(store.timeBlock).toBe(0)
  })

  it('останавливает локальный тик, если на бэке сессия на паузе', async () => {
    vi.useFakeTimers()
    const store = useTimerStore()
    store.initSession({
      pomodoroTime: 25,
      breakTime: 5,
      longBreakTime: 15,
      longBreakInterval: 4,
      countPomodoro: 10,
      taskId: 'task-1',
    })
    store.nextPhase()
    store.startTimer()
    expect(store.isActive).toBe(true)

    vi.mocked(api.get).mockResolvedValue({
      data: {
        taskId: 'task-1',
        phase: 1,
        lastStartTime: null,
        countTimeAfterPause: 500,
        isActive: false,
        task: {
          pomodoroConfig: {
            pomodoroDuration: 25,
            shortBreak: 5,
            longBreak: 15,
            longBreakInterval: 4,
            pomodoroCount: 10,
          },
        },
      },
    })

    await store.restoreSession()

    expect(store.isActive).toBe(false)
    expect(store.phase).toBe(1)
    expect(store.timeBlock).toBe(500)
    expect(store.timerInterval).toBeNull()
  })
})

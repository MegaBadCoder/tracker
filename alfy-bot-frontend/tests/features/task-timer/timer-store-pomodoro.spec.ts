import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTimerStore } from '@/features/task-timer/model/timer-store'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

const POMODORO_TASK = {
  id: 'task-1',
  title: 'Задача',
  pomodoroTime: 25,
  breakTime: 5,
  longBreakTime: 15,
  longBreakInterval: 4,
  pomodoroCount: 4,
}

describe('timer store — запись помодоро', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
  })

  it('завершение рабочей фазы делегирует инкремент в task-store', async () => {
    const timer = useTimerStore()
    const tasks = useTaskStore()
    const spy = vi.spyOn(tasks, 'incrementPomodoro').mockResolvedValue(undefined)

    timer.startTask(POMODORO_TASK)
    // Phase 1 is work; half of it elapsed.
    timer.timeBlock = timer.getPhaseInfo(1).time / 2
    timer.stopTimeBlock()
    await Promise.resolve()

    expect(spy).toHaveBeenCalledWith('task-1', 0.5)
  })

  it('не ходит в /tasks/:id/pomodoro напрямую', async () => {
    const timer = useTimerStore()
    const tasks = useTaskStore()
    vi.spyOn(tasks, 'incrementPomodoro').mockResolvedValue(undefined)

    timer.startTask(POMODORO_TASK)
    timer.timeBlock = timer.getPhaseInfo(1).time / 2
    timer.stopTimeBlock()
    await Promise.resolve()

    const pomodoroCalls = vi
      .mocked(api.patch)
      .mock.calls.filter(([url]) => String(url).includes('/pomodoro'))
    expect(pomodoroCalls).toHaveLength(0)
  })

  it('завершение фазы перерыва помодоро не записывает', async () => {
    const timer = useTimerStore()
    const tasks = useTaskStore()
    const spy = vi.spyOn(tasks, 'incrementPomodoro').mockResolvedValue(undefined)

    timer.startTask(POMODORO_TASK)
    timer.nextPhase(2) // phase 2 is a break
    timer.timeBlock = timer.getPhaseInfo(2).time / 2
    timer.stopTimeBlock()
    await Promise.resolve()

    expect(spy).not.toHaveBeenCalled()
  })
})

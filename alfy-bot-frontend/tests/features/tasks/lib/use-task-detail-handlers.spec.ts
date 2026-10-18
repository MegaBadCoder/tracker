import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import type { Task, ChecklistItem } from '@/features/tasks/model/types'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Test task',
  description: '',
  completed: false,
  pomodoroCompleted: 0,
  ...overrides,
})

function createMockStore(initialTasks: Task[] = []) {
  return {
    tasks: ref<Task[]>(initialTasks),
    updateTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    updateChecklist: vi.fn().mockResolvedValue(undefined),
    updatePomodoroConfig: vi.fn().mockResolvedValue(undefined),
  }
}

describe('useTaskDetailHandlers', () => {
  let store: ReturnType<typeof createMockStore>
  let confirmFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createMockStore([makeTask()])
    confirmFn = vi.fn().mockResolvedValue(true)
  })

  function setup() {
    return useTaskDetailHandlers(store as any, confirmFn)
  }

  // Позитивные

  it('handleOpenTask устанавливает selectedTask и isDetailOpen', () => {
    const { handleOpenTask, selectedTask, isDetailOpen } = setup()
    const task = makeTask({ id: '42', title: 'Open me' })

    handleOpenTask(task)

    expect(selectedTask.value).toEqual(task)
    expect(isDetailOpen.value).toBe(true)
  })

  it('handleUpdateTask вызывает store.updateTask', async () => {
    const task = makeTask({ id: '1', title: 'Updated' })
    const { handleUpdateTask } = setup()

    await handleUpdateTask(task)

    expect(store.updateTask).toHaveBeenCalledWith('1', task, false)
  })

  it('handleUpdateTask при смене dueDate у recurring спрашивает про серию', async () => {
    const monday = new Date(2026, 3, 6, 10, 0)
    const wednesday = new Date(2026, 3, 8, 15, 0)
    const original = makeTask({
      id: '1',
      dueDate: monday,
      recurrence: { frequency: 'weekly', interval: 1 },
    })
    store = createMockStore([original])
    confirmFn.mockResolvedValueOnce(false)
    const { handleUpdateTask } = useTaskDetailHandlers(store as any, confirmFn)

    await handleUpdateTask({ ...original, dueDate: wednesday })

    expect(store.updateTask).toHaveBeenCalledWith(
      '1',
      { dueDate: wednesday, rescheduleScope: 'this' },
      false,
    )
    expect(confirmFn).toHaveBeenCalled()
  })

  it('handleDeleteFromDialog закрывает dialog, подтверждает и удаляет задачу', async () => {
    const { handleDeleteFromDialog, isDetailOpen, selectedTask, handleOpenTask } = setup()
    handleOpenTask(makeTask())

    await handleDeleteFromDialog('1')

    expect(isDetailOpen.value).toBe(false)
    expect(selectedTask.value).toBe(null)
    expect(confirmFn).toHaveBeenCalled()
    expect(store.deleteTask).toHaveBeenCalledWith('1')
  })

  // Негативные

  it('handleUpdateTask откатывает при ошибке store', async () => {
    const originalTask = makeTask({ id: '1', title: 'Original' })
    store = createMockStore([originalTask])
    store.updateTask.mockRejectedValueOnce(new Error('fail'))
    const { handleUpdateTask, selectedTask, handleOpenTask } = useTaskDetailHandlers(store as any, confirmFn)

    handleOpenTask(originalTask)

    await handleUpdateTask(makeTask({ id: '1', title: 'Updated' }))

    // After rollback, store task should be original
    expect(store.tasks.value[0]!.title).toBe('Original')
    expect(selectedTask.value!.title).toBe('Original')
  })

  it('handleDeleteFromDialog не удаляет если confirm = false', async () => {
    confirmFn.mockResolvedValueOnce(false)
    const { handleDeleteFromDialog, isDetailOpen, handleOpenTask } = setup()
    handleOpenTask(makeTask())

    await handleDeleteFromDialog('1')

    // Dialog закрывается в любом случае
    expect(isDetailOpen.value).toBe(false)
    expect(store.deleteTask).not.toHaveBeenCalled()
  })

  it('handleUpdatePomodoroConfig ставит isPomodoroTask на selectedTask', async () => {
    const task = makeTask({ id: '1' })
    store = createMockStore([task])
    const { handleOpenTask, handleUpdatePomodoroConfig, selectedTask } = useTaskDetailHandlers(store as any, confirmFn)
    handleOpenTask(task)

    await handleUpdatePomodoroConfig('1', { pomodoroCount: 2, pomodoroDuration: 25 })

    expect(selectedTask.value!.isPomodoroTask).toBe(true)
    expect(selectedTask.value!.pomodoroCount).toBe(2)
    expect(store.updatePomodoroConfig).toHaveBeenCalledWith('1', { pomodoroCount: 2, pomodoroDuration: 25 })
  })

  it('handleUpdatePomodoroConfig с null снимает isPomodoroTask', async () => {
    const task = makeTask({ id: '1', isPomodoroTask: true, pomodoroCount: 4 })
    store = createMockStore([task])
    const { handleOpenTask, handleUpdatePomodoroConfig, selectedTask } = useTaskDetailHandlers(store as any, confirmFn)
    handleOpenTask(task)

    await handleUpdatePomodoroConfig('1', null)

    expect(selectedTask.value!.isPomodoroTask).toBe(false)
    expect(store.updatePomodoroConfig).toHaveBeenCalledWith('1', null)
  })
  it.each(['task', 'checklist', 'pomodoro'] as const)('keeps the new selection and rolls back by id after %s failure', async (kind) => {
    const first = makeTask({ id: '1', checklist: { items: [] }, isPomodoroTask: false })
    const second = makeTask({ id: '2', title: 'Second' })
    store = createMockStore([first, second])
    let reject!: (reason: Error) => void
    const pending = new Promise((_, fail) => {
      reject = fail
    })
    store.updateTask.mockReturnValue(pending)
    store.updateChecklist.mockReturnValue(pending)
    store.updatePomodoroConfig.mockReturnValue(pending)
    const handlers = setup()
    handlers.handleOpenTask(first)
    const result = kind === 'task'
      ? handlers.handleUpdateTask({ ...first, title: 'Edited' })
      : kind === 'checklist'
        ? handlers.handleUpdateChecklist('1', [{ id: 'item', text: 'New', completed: false }] as ChecklistItem[])
        : handlers.handleUpdatePomodoroConfig('1', { pomodoroCount: 4 })
    store.tasks.value.reverse()
    handlers.handleOpenTask(second)
    reject(new Error('Failed'))
    await result
    expect(store.tasks.value.map(task => task.id)).toEqual(['2', '1'])
    expect(store.tasks.value[0]).toEqual(second)
    expect(store.tasks.value[1]).toEqual(first)
    expect(handlers.selectedTask.value).toEqual(second)
  })

  it.each(['task', 'checklist', 'pomodoro'] as const)('does not resurrect removed task on %s failure', async (kind) => {
    const first = makeTask({ id: '1' })
    const second = makeTask({ id: '2', title: 'Second' })
    store = createMockStore([first, second])
    let reject!: (reason: Error) => void
    const pending = new Promise((_, fail) => {
      reject = fail
    })
    store.updateTask.mockReturnValue(pending)
    store.updateChecklist.mockReturnValue(pending)
    store.updatePomodoroConfig.mockReturnValue(pending)
    const handlers = setup()
    handlers.handleOpenTask(first)
    const result = kind === 'task'
      ? handlers.handleUpdateTask({ ...first, title: 'Edited' })
      : kind === 'checklist'
        ? handlers.handleUpdateChecklist('1', [])
        : handlers.handleUpdatePomodoroConfig('1', { pomodoroCount: 4 })
    store.tasks.value = [second]
    handlers.handleOpenTask(second)
    reject(new Error('Failed'))
    await result
    expect(store.tasks.value).toEqual([second])
    expect(handlers.selectedTask.value).toEqual(second)
  })
})

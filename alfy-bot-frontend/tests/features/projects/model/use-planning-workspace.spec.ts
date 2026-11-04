import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { api } from '@/api/client'
import * as planningApi from '@/features/projects/api/planning-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { usePlanningWorkspace } from '@/features/projects/model/use-planning-workspace'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/planning-api', () => ({ fetchPlanning: vi.fn(), proposePlan: vi.fn(), movePlanningItems: vi.fn(), undoPlanningMove: vi.fn(), orderPlanningTasks: vi.fn() }))
vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } }))
const context = { sprintId: 'sprint', capacityMinutes: 120, reserveMinutes: 0, plannedMinutes: 0, remainingMinutes: 120, unestimatedCount: 0, otherProjectsMinutes: 0, historicalCapacityMinutes: null, historySampleCount: 0, tasks: [], stories: [], carryoverCounts: {} }
const proposal = { taskIds: ['task'], storyIds: [], totalMinutes: 60, unestimatedIds: [], excluded: [], reasons: [{ id: 'task', reason: 'По цели' }] }

describe('планирование', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(planningApi.fetchPlanning).mockResolvedValue({ data: context } as never)
  })

  it('после успешного изменения задачи обновляет оценки и снимает устаревшее предложение', async () => {
    const task = { id: 'task', title: 'До', projectId: 'project', sprintId: 'sprint', groupId: null, completed: false, order: 0, durationMinutes: 30 }
    useTaskStore().tasks = [task]
    vi.mocked(planningApi.fetchPlanning).mockResolvedValue({ data: { ...context, plannedMinutes: 30, tasks: [{ ...task, estimateMinutes: 30, blocked: false }] } } as never)
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))!
    await flushPromises()
    workspace.proposal.value = proposal
    workspace.undoToken.value = 'undo'
    let resolve!: (value: never) => void
    vi.mocked(api.patch).mockImplementation(() => new Promise((done) => {
      resolve = done
    }) as never)
    const updating = useTaskStore().updateTask('task', { title: 'После', durationMinutes: 90 })
    await nextTick()
    expect(planningApi.fetchPlanning).toHaveBeenCalledTimes(1)
    vi.mocked(planningApi.fetchPlanning).mockResolvedValue({ data: { ...context, plannedMinutes: 90, tasks: [{ ...task, title: 'После', estimateMinutes: 90, blocked: false }] } } as never)
    resolve({ data: { task: { ...task, title: 'После', durationMinutes: 90 } } } as never)
    await updating
    await flushPromises()
    expect(planningApi.fetchPlanning).toHaveBeenCalledTimes(2)
    expect(workspace.context.value?.plannedMinutes).toBe(90)
    expect(workspace.context.value?.tasks[0]?.title).toBe('После')
    expect(workspace.proposal.value).toBeNull()
    expect(workspace.undoToken.value).toBe('undo')
    scope.stop()
  })

  it('позднее предложение не возвращается после внешнего изменения задачи', async () => {
    const task = { id: 'task', title: 'Задача', projectId: 'project', completed: false }
    useTaskStore().tasks = [task]
    let resolveProposal!: (value: never) => void
    vi.mocked(planningApi.proposePlan).mockImplementation(() => new Promise((done) => {
      resolveProposal = done
    }) as never)
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))!
    await flushPromises()
    const pending = workspace.propose(120, 'Оплата')
    vi.mocked(api.patch).mockResolvedValue({ data: { task: { ...task, title: 'Изменена' } } })
    await useTaskStore().updateTask('task', { title: 'Изменена' })
    await flushPromises()
    resolveProposal({ data: proposal } as never)
    await pending
    expect(workspace.proposal.value).toBeNull()
    expect(workspace.selectedTaskIds.value).toEqual([])
    scope.stop()
  })

  it('после уничтожения области отписывается от завершения записей', async () => {
    const task = { id: 'task', title: 'Задача', projectId: 'project', completed: false }
    useTaskStore().tasks = [task]
    let resolveUpdate!: (value: never) => void
    vi.mocked(api.patch).mockImplementation(() => new Promise((done) => {
      resolveUpdate = done
    }) as never)
    const scope = effectScope()
    scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))
    await flushPromises()
    const pending = useTaskStore().updateTask('task', { title: 'Изменена' })
    scope.stop()
    resolveUpdate({ data: { task: { ...task, title: 'Изменена' } } } as never)
    await pending
    await flushPromises()
    expect(planningApi.fetchPlanning).toHaveBeenCalledTimes(1)
  })

  it('удаление задачи очищает её выделение после ответа сервера', async () => {
    const task = { id: 'task', title: 'До', projectId: 'project', completed: false }
    useTaskStore().tasks = [task]
    vi.mocked(planningApi.fetchPlanning).mockResolvedValue({ data: { ...context, tasks: [{ ...task, estimateMinutes: 30, blocked: false }] } } as never)
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))!
    await flushPromises()
    workspace.selectedTaskIds.value = ['task']
    vi.mocked(api.delete).mockResolvedValue({ data: { deletedIds: ['task'] } })
    vi.mocked(planningApi.fetchPlanning).mockResolvedValue({ data: context } as never)
    await useTaskStore().deleteTask('task')
    await flushPromises()
    expect(workspace.context.value?.tasks).toEqual([])
    expect(workspace.selectedTaskIds.value).toEqual([])
    scope.stop()
  })

  it('предложение только выбирает элементы до явного применения', async () => {
    vi.mocked(planningApi.proposePlan).mockResolvedValue({ data: proposal } as never)
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))!
    await flushPromises()
    await workspace.propose(120, 'Оплата')
    expect(workspace.selectedTaskIds.value).toEqual(['task'])
    expect(planningApi.movePlanningItems).not.toHaveBeenCalled()
    scope.stop()
  })

  it('не подставляет предложение прошлого проекта после перехода', async () => {
    let resolve!: (value: never) => void
    vi.mocked(planningApi.proposePlan).mockImplementation(() => new Promise((done) => {
      resolve = done
    }) as never)
    const project = ref('first')
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(project, ref<string | null>('sprint')))!
    await flushPromises()
    const pending = workspace.propose(120, 'Оплата')
    project.value = 'second'
    await nextTick()
    resolve({ data: proposal } as never)
    await pending
    expect(workspace.proposal.value).toBeNull()
    expect(workspace.selectedTaskIds.value).toEqual([])
    expect(workspace.notice.value).toBe('')
    scope.stop()
  })

  it('не переносит токен отмены в другой проект при позднем ответе', async () => {
    let resolve!: (value: never) => void
    vi.mocked(planningApi.movePlanningItems).mockImplementation(() => new Promise((done) => {
      resolve = done
    }) as never)
    const project = ref('first')
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(project, ref<string | null>('sprint')))!
    await flushPromises()
    workspace.selectedTaskIds.value = ['task']
    const pending = workspace.move('sprint')
    project.value = 'second'
    await nextTick()
    resolve({ data: { updated: 1, undoToken: 'first-token' } } as never)
    await pending
    expect(workspace.undoToken.value).toBeNull()
    expect(workspace.notice.value).toBe('')
    scope.stop()
  })

  it('после сохранения и сбоя обновления показывает ошибку без сообщения об успехе', async () => {
    vi.mocked(planningApi.movePlanningItems).mockResolvedValue({ data: { updated: 1, undoToken: 'undo' } } as never)
    vi.spyOn(useTaskStore(), 'fetchTasks').mockResolvedValue(undefined)
    vi.spyOn(useGroupStore(), 'fetchGroups').mockResolvedValue(undefined)
    vi.spyOn(useSprintStore(), 'fetchSprints').mockResolvedValue(undefined)
    const scope = effectScope()
    const workspace = scope.run(() => usePlanningWorkspace(ref('project'), ref<string | null>('sprint')))!
    await flushPromises()
    vi.mocked(planningApi.fetchPlanning).mockRejectedValue(new Error('Нет сети'))
    workspace.selectedTaskIds.value = ['task']
    await workspace.move('sprint')
    expect(workspace.error.value).toContain('Нет сети')
    expect(workspace.notice.value).toBe('')
    expect(workspace.undoToken.value).toBe('undo')
    scope.stop()
  })
})

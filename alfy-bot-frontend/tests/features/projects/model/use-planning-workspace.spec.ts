import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
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

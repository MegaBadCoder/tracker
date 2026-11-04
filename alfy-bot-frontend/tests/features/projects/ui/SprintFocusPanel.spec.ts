import type { BoardGroupNode, Sprint } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { fetchPlanning } from '@/features/projects/api/planning-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useStoryWorkflowStore } from '@/features/projects/model/story-workflow-store'
import SprintFocusPanel from '@/features/projects/ui/SprintFocusPanel.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/planning-api', () => ({ fetchPlanning: vi.fn() }))
vi.mock('@/api/client', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('@/features/task-timer', () => ({ useTimerStore: () => ({ isActive: false }), getTaskTimerState: vi.fn(), toTimerTask: vi.fn() }))
const task = { id: 'task', title: 'Доступная задача', projectId: 'project', sprintId: 'sprint', groupId: null, completed: false, order: 0, durationMinutes: 30 }
const context = { today: '2026-11-04', sprintId: 'sprint', capacityMinutes: 120, reserveMinutes: 0, plannedMinutes: 30, remainingMinutes: 90, unestimatedCount: 0, otherProjectsMinutes: 0, historicalCapacityMinutes: null, historySampleCount: 0, tasks: [{ ...task, estimateMinutes: 30, blocked: false }], stories: [], carryoverCounts: {} }

function render() {
  return mount(SprintFocusPanel, { props: { projectId: 'project' }, global: { stubs: { StoryStatusPicker: true } } })
}

describe('фокус спринта', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useSprintStore().lists.project = [{ id: 'sprint', projectId: 'project', status: 'active', name: 'Спринт', goal: 'Результат' } as Sprint]
    useGroupStore().trees.project = []
    useStoryWorkflowStore().catalogs.project = []
    useTaskStore().tasks = [task]
    vi.mocked(fetchPlanning).mockResolvedValue({ data: context } as never)
  })

  it('не предлагает задачи архивной или отложенной истории и объясняет причину', async () => {
    const stories = [
      { id: 'archived', title: 'Архивная история', type: 'story', status: 'open', sprintId: 'sprint', archived: true, children: [] },
      { id: 'later', title: 'Отложенная история', type: 'story', status: 'open', sprintId: 'sprint', deferredUntil: '2026-11-05', children: [] },
    ]
    useGroupStore().trees.project = [{ id: 'epic', children: stories } as BoardGroupNode]
    vi.mocked(fetchPlanning).mockResolvedValue({ data: { ...context, tasks: [...context.tasks, ...stories.map(story => ({ ...context.tasks[0], id: story.id, groupId: story.id, title: `${story.title}: задача` }))] } } as never)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('li').map(row => row.text())).toEqual(['Доступная задача30 мин'])
    expect(wrapper.text()).toContain('История в архиве')
    expect(wrapper.text()).toContain('Отложена до 2026-11-05')
    wrapper.unmount()
  })

  it('обновляет контекст после успешного изменения задачи на месте', async () => {
    const wrapper = render()
    await flushPromises()
    vi.mocked(api.patch).mockResolvedValue({ data: { task: { ...task, title: 'Новое имя', durationMinutes: 90 } } })
    vi.mocked(fetchPlanning).mockResolvedValue({ data: { ...context, plannedMinutes: 90, tasks: [{ ...context.tasks[0], title: 'Новое имя', estimateMinutes: 90 }] } } as never)
    await useTaskStore().updateTask('task', { title: 'Новое имя', durationMinutes: 90 })
    await flushPromises()
    expect(wrapper.findAll('li').map(row => row.text())).toEqual(['Новое имя90 мин'])
    wrapper.unmount()
  })
})

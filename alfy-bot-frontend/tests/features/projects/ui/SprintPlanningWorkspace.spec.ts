import type { BoardGroupNode, Sprint } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlanning } from '@/features/projects/api/planning-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useStoryWorkflowStore } from '@/features/projects/model/story-workflow-store'
import SprintPlanningWorkspace from '@/features/projects/ui/SprintPlanningWorkspace.vue'

vi.mock('@/features/projects/api/planning-api', () => ({ fetchPlanning: vi.fn() }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('выбор истории для планирования', () => {
  it('учитывает только незавершённые задачи истории, а выполненную позволяет выбрать явно', async () => {
    const story = { id: 'story', projectId: 'project', title: 'История', type: 'story', parentId: 'epic', status: 'open', workflowStatusId: 'ready', sprintId: null, order: 0, children: [] } as BoardGroupNode
    useGroupStore().trees.project = [{ id: 'epic', children: [story] } as BoardGroupNode]
    useStoryWorkflowStore().catalogs.project = [{ id: 'ready', name: 'Готова', category: 'ready', color: '#000000' }]
    useSprintStore().lists.project = [{ id: 'sprint', projectId: 'project', name: 'Спринт', goal: 'Цель', status: 'planned', capacityMinutes: 120, reserveMinutes: 0 } as Sprint]
    vi.mocked(fetchPlanning).mockResolvedValue({ data: { today: '2026-11-04', sprintId: 'sprint', capacityMinutes: 120, reserveMinutes: 0, plannedMinutes: 0, remainingMinutes: 120, unestimatedCount: 0, otherProjectsMinutes: 0, historicalCapacityMinutes: null, historySampleCount: 0, stories: [story], carryoverCounts: {}, tasks: [
      { id: 'open', title: 'Открытая', groupId: 'story', sprintId: null, completed: false, estimateMinutes: 60, order: 0, blocked: false },
      { id: 'done', title: 'Выполненная', groupId: 'story', sprintId: null, completed: true, estimateMinutes: 30, order: 1, blocked: false },
    ] } } as never)
    const wrapper = mount(SprintPlanningWorkspace, { props: { projectId: 'project' }, global: { stubs: { StoryStatusPicker: true, StoryWorkflowDialog: true } } })
    await flushPromises()
    await wrapper.get('input[aria-label="Выбрать историю История"]').setValue(true)
    expect(wrapper.text()).toContain('Выбрано 1 историй, 0 задач · 60 мин')
    const showCompleted = wrapper.findAll('label').find(label => label.text() === 'Показать выполненные')!
    await showCompleted.get('input').setValue(true)
    const completed = wrapper.get<HTMLInputElement>('input[aria-label="Выбрать задачу Выполненная"]')
    const unfinished = wrapper.get<HTMLInputElement>('input[aria-label="Выбрать задачу Открытая"]')
    expect(completed.element.disabled).toBe(false)
    expect(completed.element.checked).toBe(false)
    expect(unfinished.element.checked).toBe(true)
    expect(unfinished.element.disabled).toBe(true)
    await completed.setValue(true)
    expect(wrapper.text()).toContain('Выбрано 1 историй, 1 задач · 90 мин')
    wrapper.unmount()
  })
})

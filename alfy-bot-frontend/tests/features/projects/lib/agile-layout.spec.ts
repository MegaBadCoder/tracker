import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { buildAgileRows } from '@/features/projects/lib/agile-layout'

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'epic-1',
    projectId: 'proj-1',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    ...overrides,
  }
}

describe('buildAgileRows', () => {
  it('упорядочивает строки: эпики по order, внутри — истории по order, затем задачи эпика без истории, в конце «Без эпика»', () => {
    const epicB = makeGroup({
      id: 'epic-b',
      order: 1,
      children: [
        makeGroup({ id: 'story-b2', type: 'story', parentId: 'epic-b', order: 1, children: [] }),
        makeGroup({ id: 'story-b1', type: 'story', parentId: 'epic-b', order: 0, children: [] }),
      ],
    })
    const epicA = makeGroup({ id: 'epic-a', order: 0, children: [] })

    const tasks = [
      makeTask({ id: 't-b2', groupId: 'story-b2' }),
      makeTask({ id: 't-b1', groupId: 'story-b1' }),
      makeTask({ id: 't-b-no-story', groupId: 'epic-b' }),
      makeTask({ id: 't-ungrouped', groupId: null }),
    ]

    const rows = buildAgileRows([epicB, epicA], tasks)

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ kind: 'epic', epic: { id: 'epic-a' } })
    expect(rows[1]).toMatchObject({ kind: 'epic', epic: { id: 'epic-b' } })
    if (rows[1].kind !== 'epic')
      throw new Error('expected epic row')
    expect(rows[1].stories.map(s => s.story.id)).toEqual(['story-b1', 'story-b2'])
    expect(rows[1].stories[0].tasks.map(t => t.id)).toEqual(['t-b1'])
    expect(rows[1].stories[1].tasks.map(t => t.id)).toEqual(['t-b2'])
    expect(rows[1].epicTasks.map(t => t.id)).toEqual(['t-b-no-story'])
    expect(rows[2]).toMatchObject({ kind: 'ungrouped' })
    if (rows[2].kind !== 'ungrouped')
      throw new Error('expected ungrouped row')
    expect(rows[2].tasks.map(t => t.id)).toEqual(['t-ungrouped'])
  })

  it('задачи с groupId === null попадают в «Без эпика»', () => {
    const epic = makeGroup()
    const tasks = [makeTask({ id: 't-1', groupId: null }), makeTask({ id: 't-2', groupId: undefined })]

    const rows = buildAgileRows([epic], tasks)
    const ungrouped = rows.find(r => r.kind === 'ungrouped')

    expect(ungrouped).toBeDefined()
    if (ungrouped?.kind !== 'ungrouped')
      throw new Error('expected ungrouped row')
    expect(ungrouped.tasks.map(t => t.id)).toEqual(['t-1', 't-2'])
  })

  it('проект без единой группы рендерится: одна строка «Без эпика» со всеми задачами', () => {
    const tasks = [makeTask({ id: 't-1' }), makeTask({ id: 't-2' })]

    const rows = buildAgileRows([], tasks)

    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('ungrouped')
    if (rows[0].kind !== 'ungrouped')
      throw new Error('expected ungrouped row')
    expect(rows[0].tasks.map(t => t.id)).toEqual(['t-1', 't-2'])
  })

  it('задача со ссылкой на несуществующую группу не теряется — попадает в «Без эпика»', () => {
    const epic = makeGroup()
    const tasks = [makeTask({ id: 't-orphan', groupId: 'group-that-does-not-exist' })]

    const rows = buildAgileRows([epic], tasks)
    const ungrouped = rows.find(r => r.kind === 'ungrouped')

    expect(ungrouped).toBeDefined()
    if (ungrouped?.kind !== 'ungrouped')
      throw new Error('expected ungrouped row')
    expect(ungrouped.tasks.map(t => t.id)).toEqual(['t-orphan'])
  })
})

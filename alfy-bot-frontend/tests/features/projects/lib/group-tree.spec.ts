import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { deletionImpact, findGroup, groupLabel, groupPath, groupProgress, groupTaskIds } from '@/features/projects/lib/group-tree'

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

describe('findGroup', () => {
  it('находит группу верхнего уровня и вложенную историю', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const tree = [makeGroup({ id: 'epic-1', children: [story] })]

    expect(findGroup(tree, 'epic-1')?.id).toBe('epic-1')
    expect(findGroup(tree, 'story-1')?.id).toBe('story-1')
  })

  it('возвращает undefined для отсутствующего id', () => {
    const tree = [makeGroup({ id: 'epic-1' })]
    expect(findGroup(tree, 'missing')).toBeUndefined()
  })
})

describe('groupPath', () => {
  it('для эпика возвращает сам эпик и story: null', () => {
    const epic = makeGroup({ id: 'epic-1' })
    const path = groupPath([epic], 'epic-1')
    expect(path).toEqual({ epic, story: null })
  })

  it('для истории возвращает её родительский эпик и саму историю', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeGroup({ id: 'epic-1', children: [story] })
    const path = groupPath([epic], 'story-1')
    expect(path).toEqual({ epic, story })
  })

  it('для отсутствующего id возвращает null', () => {
    const epic = makeGroup({ id: 'epic-1' })
    expect(groupPath([epic], 'missing')).toBeNull()
  })
})

describe('groupLabel', () => {
  it('для groupId: null возвращает «Без эпика»', () => {
    const tree = [makeGroup({ id: 'epic-1' })]
    expect(groupLabel(tree, null)).toBe('Без эпика')
  })

  it('для истории возвращает «Эпик › История»', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', title: 'История' })
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик', children: [story] })
    expect(groupLabel([epic], 'story-1')).toBe('Эпик › История')
  })

  it('для эпика возвращает только его название', () => {
    const epic = makeGroup({ id: 'epic-1', title: 'Эпик' })
    expect(groupLabel([epic], 'epic-1')).toBe('Эпик')
  })

  it('для не найденного id возвращает null', () => {
    const tree = [makeGroup({ id: 'epic-1' })]
    expect(groupLabel(tree, 'missing')).toBeNull()
  })
})

describe('groupTaskIds', () => {
  it('для эпика возвращает id эпика и id всех его историй', () => {
    const story1 = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const story2 = makeGroup({ id: 'story-2', type: 'story', parentId: 'epic-1' })
    const epic = makeGroup({ id: 'epic-1', children: [story1, story2] })

    expect(groupTaskIds(epic).sort()).toEqual(['epic-1', 'story-1', 'story-2'])
  })

  it('для истории возвращает только её собственный id', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', children: [] })
    expect(groupTaskIds(story)).toEqual(['story-1'])
  })
})

describe('groupProgress', () => {
  it('считает эпик: задачи эпика и задачи его историй вместе', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const epic = makeGroup({ id: 'epic-1', children: [story] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'epic-1', completed: true }),
      makeTask({ id: 't2', groupId: 'epic-1', completed: false }),
      makeTask({ id: 't3', groupId: 'story-1', completed: true }),
      makeTask({ id: 't4', groupId: 'other', completed: true }),
    ]

    expect(groupProgress(epic, tasks)).toEqual({ done: 2, total: 3 })
  })

  it('считает историю: только задачи, привязанные к ней', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', children: [] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'story-1', completed: true }),
      makeTask({ id: 't2', groupId: 'story-1', completed: false }),
      makeTask({ id: 't3', groupId: 'epic-1', completed: true }),
    ]

    expect(groupProgress(story, tasks)).toEqual({ done: 1, total: 2 })
  })
})

describe('deletionImpact', () => {
  it('для эпика считает число историй и задачи эпика + всех историй', () => {
    const story1 = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' })
    const story2 = makeGroup({ id: 'story-2', type: 'story', parentId: 'epic-1' })
    const epic = makeGroup({ id: 'epic-1', children: [story1, story2] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'epic-1' }),
      makeTask({ id: 't2', groupId: 'story-1' }),
      makeTask({ id: 't3', groupId: 'story-2' }),
      makeTask({ id: 't4', groupId: 'other' }),
    ]

    expect(deletionImpact(epic, tasks)).toEqual({ stories: 2, tasks: 3 })
  })

  it('для истории stories всегда 0, tasks — только её задачи', () => {
    const story = makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1', children: [] })
    const tasks = [
      makeTask({ id: 't1', groupId: 'story-1' }),
      makeTask({ id: 't2', groupId: 'epic-1' }),
    ]

    expect(deletionImpact(story, tasks)).toEqual({ stories: 0, tasks: 1 })
  })
})

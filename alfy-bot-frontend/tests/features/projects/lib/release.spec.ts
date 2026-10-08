import type { BoardGroupNode, Release } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import {
  defaultReleaseTarget,
  groupReleaseTasks,
  isReleaseOverdue,
  releaseDeletionMessage,
  releaseLabel,
  releaseProgress,
  releaseTasks,
} from '@/features/projects/lib/release'

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'v1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned',
    releasedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    ...overrides,
  }
}

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
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

describe('releaseTasks', () => {
  it('возвращает только задачи с данным releaseId', () => {
    const tasks = [
      makeTask({ id: 'a', releaseId: 'rel-1' }),
      makeTask({ id: 'b', releaseId: 'rel-2' }),
      makeTask({ id: 'c', releaseId: null }),
      makeTask({ id: 'd' }),
    ]

    expect(releaseTasks(tasks, 'rel-1').map(t => t.id)).toEqual(['a'])
  })

  it('для релиза без задач возвращает пустой список', () => {
    expect(releaseTasks([makeTask({ releaseId: 'rel-2' })], 'rel-1')).toEqual([])
  })
})

describe('releaseProgress', () => {
  it('считает выполненные и все задачи релиза', () => {
    const tasks = [
      makeTask({ id: 'a', releaseId: 'rel-1', completed: true }),
      makeTask({ id: 'b', releaseId: 'rel-1', completed: false }),
      makeTask({ id: 'c', releaseId: 'rel-2', completed: true }),
    ]

    expect(releaseProgress(tasks, 'rel-1')).toEqual({ done: 1, total: 2 })
  })

  it('для пустого релиза возвращает нули', () => {
    expect(releaseProgress([], 'rel-1')).toEqual({ done: 0, total: 0 })
  })
})

describe('isReleaseOverdue', () => {
  const today = new Date(2026, 9, 10, 15, 30)

  it('planned с датой релиза в прошлом просрочен', () => {
    expect(isReleaseOverdue(makeRelease({ releaseDate: '2026-10-09' }), today)).toBe(true)
  })

  it('в день релиза ещё не просрочен, независимо от времени суток', () => {
    expect(isReleaseOverdue(makeRelease({ releaseDate: '2026-10-10' }), new Date(2026, 9, 10, 23, 59))).toBe(false)
  })

  it('дата релиза в будущем — не просрочен', () => {
    expect(isReleaseOverdue(makeRelease({ releaseDate: '2026-10-11' }), today)).toBe(false)
  })

  it('без даты релиза не просрочен', () => {
    expect(isReleaseOverdue(makeRelease({ releaseDate: null }), today)).toBe(false)
  })

  it('выпущенный релиз не бывает просроченным', () => {
    expect(isReleaseOverdue(makeRelease({ status: 'released', releaseDate: '2026-01-01' }), today)).toBe(false)
  })
})

describe('defaultReleaseTarget', () => {
  it('возвращает id первого planned по order, кроме текущего', () => {
    const planned = [
      makeRelease({ id: 'r3', order: 3 }),
      makeRelease({ id: 'r1', order: 1 }),
      makeRelease({ id: 'r2', order: 2 }),
    ]

    expect(defaultReleaseTarget(planned, 'r1')).toBe('r2')
    expect(defaultReleaseTarget(planned, 'r3')).toBe('r1')
  })

  it('без других planned-релизов возвращает none', () => {
    expect(defaultReleaseTarget([makeRelease({ id: 'r1' })], 'r1')).toBe('none')
    expect(defaultReleaseTarget([], 'r1')).toBe('none')
  })

  it('не мутирует переданный список', () => {
    const planned = [makeRelease({ id: 'r2', order: 2 }), makeRelease({ id: 'r1', order: 1 })]

    defaultReleaseTarget(planned, 'x')

    expect(planned.map(r => r.id)).toEqual(['r2', 'r1'])
  })
})

describe('releaseDeletionMessage', () => {
  const release = makeRelease({ name: 'v1.0' })

  it('без задач — только вопрос', () => {
    expect(releaseDeletionMessage(release, 0)).toBe('Удалить релиз „v1.0“?')
  })

  it('одна задача', () => {
    expect(releaseDeletionMessage(release, 1)).toBe('Удалить релиз „v1.0“? 1 задача останется без релиза.')
  })

  it('три задачи', () => {
    expect(releaseDeletionMessage(release, 3)).toBe('Удалить релиз „v1.0“? 3 задачи останутся без релиза.')
  })

  it('пять задач', () => {
    expect(releaseDeletionMessage(release, 5)).toBe('Удалить релиз „v1.0“? 5 задач останутся без релиза.')
  })
})

describe('releaseLabel', () => {
  const releases = [
    makeRelease({ id: 'p', name: 'v1.0', status: 'planned' }),
    makeRelease({ id: 'r', name: 'v0.9', status: 'released' }),
  ]

  it('null и undefined — «Без релиза»', () => {
    expect(releaseLabel(releases, null)).toBe('Без релиза')
    expect(releaseLabel(releases, undefined)).toBe('Без релиза')
  })

  it('planned — просто имя', () => {
    expect(releaseLabel(releases, 'p')).toBe('v1.0')
  })

  it('выпущенный — «Имя (выпущен)»', () => {
    expect(releaseLabel(releases, 'r')).toBe('v0.9 (выпущен)')
  })

  it('релиз не найден (ещё грузится) — null, а не «Без релиза»', () => {
    expect(releaseLabel(releases, 'unknown')).toBeNull()
  })
})

describe('groupReleaseTasks', () => {
  const story1 = makeGroup({ id: 's1', type: 'story', parentId: 'e1', title: 'История 1', order: 0 })
  const story2 = makeGroup({ id: 's2', type: 'story', parentId: 'e1', title: 'История 2', order: 1 })
  const epic1 = makeGroup({ id: 'e1', title: 'Эпик 1', order: 0, children: [story2, story1] })
  const epic2 = makeGroup({ id: 'e2', title: 'Эпик 2', order: 1 })

  it('порядок: эпики по order, внутри эпика сначала задачи эпика, затем истории по order, «Без эпика» последним', () => {
    const tasks = [
      makeTask({ id: 'none', groupId: null }),
      makeTask({ id: 'e2-t', groupId: 'e2' }),
      makeTask({ id: 's2-t', groupId: 's2' }),
      makeTask({ id: 's1-t', groupId: 's1' }),
      makeTask({ id: 'e1-t', groupId: 'e1' }),
    ]

    const result = groupReleaseTasks(tasks, [epic2, epic1], null)

    expect(result.map(g => [g.epic?.id ?? null, g.story?.id ?? null, g.tasks.map(t => t.id)])).toEqual([
      ['e1', null, ['e1-t']],
      ['e1', 's1', ['s1-t']],
      ['e1', 's2', ['s2-t']],
      ['e2', null, ['e2-t']],
      [null, null, ['none']],
    ])
  })

  it('пустые группы не попадают в результат', () => {
    const result = groupReleaseTasks([makeTask({ id: 's1-t', groupId: 's1' })], [epic1, epic2], null)

    expect(result.map(g => [g.epic?.id, g.story?.id])).toEqual([['e1', 's1']])
  })

  it('задача с неизвестным groupId попадает в «Без эпика»', () => {
    const result = groupReleaseTasks([makeTask({ id: 'lost', groupId: 'ghost' })], [epic1], null)

    expect(result).toEqual([{ epic: null, story: null, tasks: [expect.objectContaining({ id: 'lost' })] }])
  })

  it('задача без groupId (undefined) попадает в «Без эпика»', () => {
    const result = groupReleaseTasks([makeTask({ id: 'plain' })], [epic1], null)

    expect(result.map(g => [g.epic, g.story, g.tasks.map(t => t.id)])).toEqual([[null, null, ['plain']]])
  })

  it('без задач возвращает пустой список', () => {
    expect(groupReleaseTasks([], [epic1], null)).toEqual([])
  })

  it('сохраняет порядок задач внутри группы', () => {
    const tasks = [makeTask({ id: 'b', groupId: 'e2' }), makeTask({ id: 'a', groupId: 'e2' })]

    expect(groupReleaseTasks(tasks, [epic2], null)[0]!.tasks.map(t => t.id)).toEqual(['b', 'a'])
  })
})

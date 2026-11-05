import type { SprintMapInput } from '@/features/projects/lib/sprint-map'
import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { buildSprintMap, flattenSprintMap } from '@/features/projects/lib/sprint-map'

function group(id: string, overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id,
    projectId: 'p',
    parentId: null,
    type: 'epic',
    title: id,
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    releaseId: null,
    sprintId: null,
    ...overrides,
  }
}

function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, title: id, completed: false, projectId: 'p', sprintId: 's', ...overrides }
}

function input(overrides: Partial<SprintMapInput> = {}): SprintMapInput {
  return {
    projectId: 'p',
    sprint: {
      id: 's',
      projectId: 'p',
      userId: 1,
      name: 'Спринт',
      goal: null,
      startDate: null,
      endDate: null,
      status: 'active',
      completedAt: null,
      order: 0,
      createdAt: '',
      updatedAt: '',
    },
    groups: [],
    tasks: [],
    columns: [],
    workflow: [],
    releases: [],
    ...overrides,
  }
}

describe('buildSprintMap', () => {
  it('считает задачи выбранного проекта и спринта ровно один раз', () => {
    const selected = task('selected', { completed: true })
    const root = buildSprintMap(input({ tasks: [selected, selected, task('other-sprint', { sprintId: 'other' }), task('other-project', { projectId: 'other' })] }))
    expect(root).toMatchObject({ key: 'sprint:s', title: 'Спринт', total: 1, done: 1, statusLabel: 'Активный' })
    expect(flattenSprintMap(root).filter(node => node.kind === 'task').map(node => node.sourceId)).toEqual(['selected'])
  })

  it('сохраняет пустые назначенные истории и их родителей', () => {
    const root = buildSprintMap(input({ groups: [group('epic', { children: [group('empty', { type: 'story', parentId: 'epic', sprintId: 's' }), group('backlog', { type: 'story', parentId: 'epic' })] }), group('absent')] }))
    expect(flattenSprintMap(root).map(node => node.key)).toEqual(['sprint:s', 'epic:epic', 'story:empty'])
    expect(root.total).toBe(0)
  })

  it('не подменяет workflow истории завершённостью её задач', () => {
    const root = buildSprintMap(input({
      groups: [group('epic', { children: [group('story', { type: 'story', parentId: 'epic', workflowStatusId: 'review', blockedReason: 'Ждём ответ' })] })],
      tasks: [task('done', { groupId: 'story', completed: true })],
      workflow: [{ id: 'review', name: 'Проверяем', category: 'review', color: '#123456' }],
    }))
    expect(flattenSprintMap(root).find(node => node.key === 'story:story')).toMatchObject({ total: 1, done: 1, statusLabel: 'Проверяем', statusCategory: 'review', statusColor: '#123456', blockedReason: 'Ждём ответ' })
    expect(root.children[0]?.statusCategory).toBe('open')
  })

  it('показывает прямые задачи эпика и задачи без доступной группы', () => {
    const root = buildSprintMap(input({ groups: [group('epic'), group('foreign', { projectId: 'other' })], tasks: [task('direct', { groupId: 'epic' }), task('null', { groupId: null }), task('unknown', { groupId: 'missing' }), task('foreign-group', { groupId: 'foreign' })] }))
    expect(root.children[0]?.children.map(node => node.key)).toEqual(['task:direct'])
    expect(root.children[1]).toMatchObject({ kind: 'ungrouped', sourceId: null, total: 3 })
    expect(root.children[1]?.children.map(node => node.key)).toEqual(['task:foreign-group', 'task:null', 'task:unknown'])
    expect(root.total).toBe(4)
  })

  it('считает работу вне спринта только в том же проекте и группе', () => {
    const root = buildSprintMap(input({ groups: [group('epic', { children: [group('story', { type: 'story', parentId: 'epic' })] })], tasks: [task('inside', { groupId: 'story' }), task('outside', { groupId: 'story', sprintId: null }), task('outside-direct', { groupId: 'epic', sprintId: 'other' }), task('foreign', { groupId: 'story', projectId: 'other', sprintId: null })] }))
    expect(root.children[0]).toMatchObject({ total: 1, outsideCount: 2 })
    expect(root.children[0]?.children[0]).toMatchObject({ total: 1, outsideCount: 1 })
  })

  it('берёт статус задачи из колонки, а выполненной — из completed', () => {
    const root = buildSprintMap(input({ columns: [{ id: 'work', projectId: 'p', title: 'На проверке', order: 1, color: '#abc' }], tasks: [task('a', { columnId: 'work' }), task('b', { columnId: 'work', completed: true })] }))
    expect(flattenSprintMap(root).find(node => node.key === 'task:a')).toMatchObject({ statusLabel: 'На проверке', statusColor: '#abc', done: 0 })
    expect(flattenSprintMap(root).find(node => node.key === 'task:b')).toMatchObject({ statusLabel: 'Выполнена', statusCategory: 'done', done: 1 })
  })

  it('сохраняет реальные релизы истории и задачи независимо от прогресса', () => {
    const root = buildSprintMap(input({
      groups: [group('story', { type: 'story', sprintId: 's', releaseId: 'r' })],
      tasks: [task('done', { groupId: 'story', completed: true, releaseId: 'r' })],
      releases: [{ id: 'r', projectId: 'p', userId: 1, name: 'Версия 2', status: 'planned', description: null, startDate: null, releaseDate: null, releasedAt: null, order: 0, createdAt: '', updatedAt: '' }],
    }))
    expect(flattenSprintMap(root).find(node => node.key === 'story:story')?.releaseNames).toEqual(['Версия 2'])
    expect(flattenSprintMap(root).find(node => node.key === 'task:done')?.releaseNames).toEqual(['Версия 2'])
  })

  it('сортирует по order и id независимо от порядка ответа, не меняя исходные данные', () => {
    const groups = [group('z', { order: 1 }), group('b'), group('a')]
    const tasks = [task('z', { groupId: 'z' }), task('b', { groupId: 'b' }), task('a', { groupId: 'a' })]
    const before = JSON.stringify({ groups, tasks })
    const root = buildSprintMap(input({ groups, tasks }))
    expect(root.children.map(node => node.key)).toEqual(['epic:a', 'epic:b', 'epic:z'])
    expect(root).toEqual(buildSprintMap(input({ groups: [...groups].reverse(), tasks: [...tasks].reverse() })))
    expect(JSON.stringify({ groups, tasks })).toBe(before)
  })
})

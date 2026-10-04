import type { BoardGroupNode } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { backlogStories, matchesEpic, standaloneBacklogTasks } from '@/features/projects/lib/backlog-stories'

const group = (id: string, parentId: string | null): BoardGroupNode => ({ id, projectId: 'project', parentId, type: parentId ? 'story' : 'epic', title: id, status: 'open', releaseId: null, order: 0, children: [] } as BoardGroupNode)
const tree = [group('epic-a', null), group('epic-b', null)]
tree[0]!.children = [group('story-a', 'epic-a'), group('empty', 'epic-a')]
tree[1]!.children = [group('story-b', 'epic-b')]
const task = (id: string, groupId: string | null, sprintId: string | null, completed = false): Task => ({ id, title: id, projectId: 'project', groupId, sprintId, completed } as Task)

describe('планирование историй', () => {
  it('фильтр эпика включает его задачи и истории, none оставляет задачи без эпика', () => {
    const tasks = [task('a', 'story-a', null), task('b', 'epic-a', null), task('c', 'story-b', null), task('d', null, null)]
    expect(tasks.filter(t => matchesEpic(t, tree, 'epic-a')).map(t => t.id)).toEqual(['a', 'b'])
    expect(tasks.filter(t => matchesEpic(t, tree, 'none')).map(t => t.id)).toEqual(['d'])
    expect(tasks.filter(t => matchesEpic(t, tree, 'all'))).toHaveLength(4)
  })

  it('разделённая история появляется в каждом спринте только со своими задачами', () => {
    const tasks = [task('a', 'story-a', 's1'), task('b', 'story-a', 's2'), task('done', 'story-a', 's1', true)]
    const first = backlogStories(tree, [tasks[0]!], tasks, 's1', 'all', false)
    const second = backlogStories(tree, [tasks[1]!], tasks, 's2', 'all', false)
    expect(first.map(row => [row.story.id, row.tasks.map(t => t.id), row.done, row.total])).toEqual([['story-a', ['a'], 1, 2]])
    expect(second.map(row => [row.story.id, row.tasks.map(t => t.id)])).toEqual([['story-a', ['b']]])
  })

  it('скрытые задачи и задачи закрытого спринта не делают историю пустой', () => {
    const tasks = [task('hidden', 'story-a', null, true), task('closed', 'story-b', 'closed')]
    expect(backlogStories(tree, [], tasks, null, 'all', false).map(row => row.story.id)).toEqual(['empty'])
    expect(backlogStories(tree, [], tasks, 's1', 'all', false)).toEqual([])
  })

  it('пустые истории подчиняются фильтру эпика и настройке завершённых', () => {
    const local = [group('epic-a', null)]
    local[0]!.children = [{ ...group('done', 'epic-a'), status: 'done' }]
    expect(backlogStories(local, [], [], null, 'all', false)).toEqual([])
    expect(backlogStories(local, [], [], null, 'epic-a', true)).toHaveLength(1)
    expect(backlogStories(local, [], [], null, 'none', true)).toEqual([])
  })

  it('задачи непосредственно в эпике остаются отдельными, задачи истории не дублируются', () => {
    const tasks = [task('a', 'story-a', 's1'), task('b', 'epic-a', 's1'), task('c', null, 's1')]
    const rows = backlogStories(tree, tasks, tasks, 's1', 'all', false)
    const ids = [...rows.flatMap(row => row.tasks.map(t => t.id)), ...standaloneBacklogTasks(tasks, tree).map(t => t.id)]
    expect(ids.sort()).toEqual(['a', 'b', 'c'])
  })
})

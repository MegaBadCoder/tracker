import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { deriveSprintMapDependencies } from '@/features/projects/lib/sprint-map-dependencies'
import { layoutSprintMap } from '@/features/projects/lib/sprint-map-layout'

function node(kind: SprintMapNode['kind'], id: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title: id, statusLabel: '', statusCategory: 'open', statusColor: null, done: 0, total: kind === 'task' ? 1 : 2, outsideCount: 0, blockedReason: null, releases: [], children }
}
const root = node('sprint', 's', [node('story', 'a', [node('task', 'a')]), node('story', 'b', [node('task', 'b')])])
const tasks: Task[] = [
  { id: 'a', title: 'Подготовить', completed: false, projectId: 'p', sprintId: 's' },
  { id: 'b', title: 'Проверить', completed: false, projectId: 'p', sprintId: 's' },
  { id: 'outside', title: 'Внешняя работа', completed: false, projectId: 'other', sprintId: 'next' },
]
const dependencies = [{ taskId: 'b', dependencyId: 'a' }, { taskId: 'b', dependencyId: 'outside' }]

function derive(selectedTaskId: string | null, showAll: boolean, collapsed = new Set<string>(), currentTasks = tasks) {
  return deriveSprintMapDependencies({ root, visibleNodes: layoutSprintMap(root, collapsed).nodes, tasks: currentTasks, dependencies, selectedTaskId, showAll })
}

describe('связи карты', () => {
  it('считает ожидание без изменения дерева и скрывает линии до выбора', () => {
    const snapshot = JSON.stringify(root)
    const result = derive(null, false)
    expect(result.waiting.get('b')).toBe(2)
    expect(result.links).toEqual([])
    expect(JSON.stringify(root)).toBe(snapshot)
  })

  it('направляет связь от предшественника к зависимой задаче', () => {
    const result = derive('b', false)
    expect(result.links[0]).toMatchObject({ dependencyId: 'a', taskId: 'b', from: { node: { key: 'task:a' } }, to: { node: { key: 'task:b' } }, completed: false })
    expect(result.links[0]?.path).toMatch(/^M/)
  })

  it('сохраняет реальную задачу при проекции на видимого предка', () => {
    const result = derive('b', false, new Set(['story:a']))
    expect(result.links[0]).toMatchObject({ predecessor: { title: 'Подготовить' }, from: { node: { key: 'story:a' } }, predecessorHidden: true })
    expect(result.links[0]?.path).toBeTruthy()
  })

  it('оставляет внешний источник в списке без фиктивного узла', () => {
    const result = derive('b', false)
    expect(result.links[1]).toMatchObject({ predecessor: { title: 'Внешняя работа', projectId: 'other' }, from: null, path: null })
    expect(layoutSprintMap(root, new Set()).nodes).toHaveLength(5)
  })

  it('снимает ожидание по живому completed без изменения зависимой задачи', () => {
    const result = derive('b', false, new Set(), tasks.map(task => task.id === 'b' ? task : { ...task, completed: true }))
    expect(result.waiting.get('b')).toBe(0)
    expect(result.links.every(link => link.completed)).toBe(true)
    expect(tasks[1]?.completed).toBe(false)
  })

  it('показывает все связи и входящие для выбранного предшественника', () => {
    expect(derive(null, true).links).toHaveLength(2)
    expect(derive('a', false).links.map(link => link.dependencyId)).toEqual(['a'])
  })

  it('не оставляет ожидание от удалённого предшественника в полном снимке задач', () => {
    const result = derive('b', false, new Set(), tasks.filter(task => task.id !== 'a'))
    expect(result.waiting.get('b')).toBe(1)
    expect(result.links.map(link => link.dependencyId)).toEqual(['outside'])
  })

  it('не теряет связь внутри общей свёрнутой ветки', () => {
    const result = derive('b', false, new Set(['sprint:s']))
    expect(result.links[0]?.from?.node.key).toBe('sprint:s')
    expect(result.links[0]?.to?.node.key).toBe('sprint:s')
    expect(result.links[0]?.path).toBeTruthy()
  })

  it('оставляет наконечник и начало вне карточек, подходит к цели горизонтально', () => {
    const link = derive('b', false).links[0]!
    expect(link.sourcePort!.x).toBeLessThan(link.from!.x - 5)
    expect(link.targetPort!.x).toBeLessThan(link.to!.x - 5)
    expect(link.path).toMatch(/H[-\d.]+$/)
    expect(link.path).toContain('Q')
    expect(link.sourcePort!.y).toBeGreaterThan(link.from!.y + link.from!.height / 2)
    expect(link.targetPort!.y).toBeLessThan(link.to!.y + link.to!.height / 2)
  })

  it('разводит пересекающиеся связи по стабильным дорожкам и учитывает их в границах', () => {
    const multiRoot = node('sprint', 's', [node('story', 'story', ['a', 'b', 'c', 'd', 'e'].map(id => node('task', id)))])
    const multiTasks = ['a', 'b', 'c', 'd', 'e'].map(id => ({ ...tasks[0]!, id }))
    const edges = ['b', 'c', 'd', 'e'].map(taskId => ({ taskId, dependencyId: 'a' }))
    const input = { root: multiRoot, visibleNodes: layoutSprintMap(multiRoot, new Set()).nodes, tasks: multiTasks, dependencies: edges, selectedTaskId: null, showAll: true }
    const result = deriveSprintMapDependencies(input)
    const lanes = result.links.map(link => link.path!.match(/H([-\d.]+)/)![1])
    expect(new Set(lanes).size).toBe(4)
    expect(result.minX).toBeLessThan(0)
    expect(deriveSprintMapDependencies({ ...input, dependencies: [...edges].reverse() }).links.map(link => link.path)).toEqual(result.links.map(link => link.path))
  })
})

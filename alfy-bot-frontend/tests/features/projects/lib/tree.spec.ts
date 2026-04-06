import { describe, it, expect, vi } from 'vitest'
import { buildTree } from '@/features/projects/lib/tree'
import type { Project, ProjectTreeNode } from '@/features/projects/model/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

describe('buildTree', () => {
  it('возвращает пустой массив для пустого списка', () => {
    expect(buildTree([])).toEqual([])
  })

  it('строит плоский список без parentId как корневые узлы', () => {
    const projects = [
      makeProject({ id: 'a', title: 'A' }),
      makeProject({ id: 'b', title: 'B' }),
    ]
    const tree = buildTree(projects)

    expect(tree).toHaveLength(2)
    expect(tree[0].children).toEqual([])
    expect(tree[1].children).toEqual([])
  })

  it('вкладывает дочерние элементы в родительские', () => {
    const projects = [
      makeProject({ id: 'parent', title: 'Родитель' }),
      makeProject({ id: 'child', title: 'Дочерний', parentId: 'parent' }),
    ]
    const tree = buildTree(projects)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('parent')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe('child')
  })

  it('сортирует по order на каждом уровне', () => {
    const projects = [
      makeProject({ id: 'b', order: 2 }),
      makeProject({ id: 'a', order: 0 }),
      makeProject({ id: 'c', order: 1 }),
    ]
    const tree = buildTree(projects)

    expect(tree.map(n => n.id)).toEqual(['a', 'c', 'b'])
  })

  it('обрабатывает 3+ уровня вложенности', () => {
    const projects = [
      makeProject({ id: 'root' }),
      makeProject({ id: 'level1', parentId: 'root' }),
      makeProject({ id: 'level2', parentId: 'level1' }),
      makeProject({ id: 'level3', parentId: 'level2' }),
    ]
    const tree = buildTree(projects)

    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].children[0].children[0].id).toBe('level3')
  })

  it('не рендерит узел с несуществующим parentId и логирует warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const projects = [
      makeProject({ id: 'orphan', parentId: 'nonexistent' }),
    ]
    const tree = buildTree(projects)

    expect(tree).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith('[projects/tree] Project has unknown parent and will be skipped', {
      projectId: 'orphan',
      parentId: 'nonexistent',
    })
    warn.mockRestore()
  })

  it('не рендерит self-parent проект и логирует warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const projects = [
      makeProject({ id: 'self', parentId: 'self' }),
      makeProject({ id: 'normal' }),
    ]
    const tree = buildTree(projects)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('normal')
    expect(warn).toHaveBeenCalledWith('[projects/tree] Project has self parent and will be skipped', { projectId: 'self' })
    warn.mockRestore()
  })

  it('обрабатывает дубликаты id без ошибок', () => {
    const projects = [
      makeProject({ id: 'dup', title: 'Первый' }),
      makeProject({ id: 'dup', title: 'Второй' }),
    ]
    // Should not throw
    expect(() => buildTree(projects)).not.toThrow()
  })
})

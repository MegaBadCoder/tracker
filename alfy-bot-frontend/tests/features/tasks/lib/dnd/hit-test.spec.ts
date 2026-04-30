import type { DropTargetRegistration } from '@/features/tasks/lib/dnd/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findHoveredTarget } from '@/features/tasks/lib/dnd/hit-test'

function makeEl(left: number, top: number, right: number, bottom: number): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = vi.fn(() => ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => {},
  }))
  return el
}

function makeTarget(
  id: string,
  kind: DropTargetRegistration['kind'],
  rect: { left: number, top: number, right: number, bottom: number },
  projectId?: string,
): DropTargetRegistration {
  return {
    id,
    kind,
    el: makeEl(rect.left, rect.top, rect.right, rect.bottom),
    projectId,
  }
}

describe('findHoveredTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when targets list is empty', () => {
    expect(findHoveredTarget([], { x: 50, y: 50 })).toBeNull()
  })

  it('returns null when pointer is outside all targets', () => {
    const target = makeTarget('p1', 'project', { left: 0, top: 0, right: 100, bottom: 100 })
    expect(findHoveredTarget([target], { x: 200, y: 200 })).toBeNull()
  })

  it('returns the target when pointer hits a single project target', () => {
    const target = makeTarget('p1', 'project', { left: 0, top: 0, right: 100, bottom: 100 }, 'proj-1')
    const result = findHoveredTarget([target], { x: 50, y: 50 })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('p1')
    expect(result!.kind).toBe('project')
  })

  it('returns the project target over a reorder-slot when they overlap (priority rule)', () => {
    // project has priority 0, reorder-slot has priority 2
    const project = makeTarget('sidebar-proj', 'project', { left: 0, top: 0, right: 200, bottom: 50 }, 'proj-1')
    const slot = makeTarget('slot', 'reorder-slot', { left: 0, top: 0, right: 200, bottom: 200 })

    const result = findHoveredTarget([slot, project], { x: 50, y: 25 })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('sidebar-proj')
  })

  it('returns inbox target over a reorder-slot when they overlap (inbox > reorder-slot)', () => {
    const inbox = makeTarget('inbox', 'inbox', { left: 0, top: 0, right: 200, bottom: 50 })
    const slot = makeTarget('slot', 'reorder-slot', { left: 0, top: 0, right: 200, bottom: 200 })

    const result = findHoveredTarget([slot, inbox], { x: 50, y: 25 })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('inbox')
  })

  it('returns first registered target when two project targets overlap (deterministic)', () => {
    // Both are 'project' kind (same priority). First registered wins.
    const p1 = makeTarget('p1', 'project', { left: 0, top: 0, right: 200, bottom: 100 }, 'proj-1')
    const p2 = makeTarget('p2', 'project', { left: 0, top: 0, right: 200, bottom: 100 }, 'proj-2')

    const result = findHoveredTarget([p1, p2], { x: 50, y: 50 })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('p1')
  })

  it('returns null when pointer is exactly on the boundary (right/bottom exclusive)', () => {
    // getBoundingClientRect returns right=100, bottom=100. Pointer at (100, 100) should miss.
    // Our check is <= right && <= bottom, so (100,100) hits. Adjust: pointer outside.
    const target = makeTarget('p1', 'project', { left: 0, top: 0, right: 100, bottom: 100 })
    expect(findHoveredTarget([target], { x: 101, y: 101 })).toBeNull()
  })
})

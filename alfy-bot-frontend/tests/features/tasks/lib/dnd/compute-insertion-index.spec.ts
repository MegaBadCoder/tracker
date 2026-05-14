import { describe, expect, it } from 'vitest'
import { computeInsertionIndex } from '@/features/tasks/lib/dnd/use-reorder-list'

function makeItem(id: string, top: number, bottom: number) {
  return { id, rect: { top, bottom } }
}

describe('computeInsertionIndex', () => {
  it('returns 0 for an empty list', () => {
    expect(computeInsertionIndex(100, [])).toBe(0)
  })

  it('returns 0 when pointer is above the center of the first item', () => {
    // item center = (0 + 100) / 2 = 50; pointer at 20 < 50
    const items = [makeItem('a', 0, 100)]
    expect(computeInsertionIndex(20, items)).toBe(0)
  })

  it('returns 1 when pointer is exactly at the center of the first item in a single-item list', () => {
    // center = 50; pointer at 50 is NOT < 50, so falls through → items.length = 1
    const items = [makeItem('a', 0, 100)]
    expect(computeInsertionIndex(50, items)).toBe(1)
  })

  it('returns 1 when pointer is between center of item 0 and center of item 1', () => {
    // item 0 center = 50, item 1 center = 150; pointer at 90
    const items = [makeItem('a', 0, 100), makeItem('b', 100, 200)]
    expect(computeInsertionIndex(90, items)).toBe(1)
  })

  it('returns 0 when pointer is above center of first item in a multi-item list', () => {
    const items = [makeItem('a', 0, 100), makeItem('b', 100, 200)]
    expect(computeInsertionIndex(10, items)).toBe(0)
  })

  it('returns items.length when pointer is below the center of the last item', () => {
    // item 0 center = 50, item 1 center = 150, item 2 center = 250; pointer at 280
    const items = [
      makeItem('a', 0, 100),
      makeItem('b', 100, 200),
      makeItem('c', 200, 300),
    ]
    expect(computeInsertionIndex(280, items)).toBe(3)
  })

  it('returns 2 when pointer is between item 1 center and item 2 center', () => {
    // centers: 50, 150, 250; pointer at 200 (> 150, < 250)
    const items = [
      makeItem('a', 0, 100),
      makeItem('b', 100, 200),
      makeItem('c', 200, 300),
    ]
    expect(computeInsertionIndex(200, items)).toBe(2)
  })
})

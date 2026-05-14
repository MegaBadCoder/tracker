import type { DropTargetRegistration, Pointer } from './types'

/**
 * Returns the drop target that the pointer is currently over.
 *
 * Priority rule (deterministic):
 *   'project' > 'inbox' > 'reorder-slot'
 *
 * Among targets of the same kind, the first registered wins.
 * This ensures sidebar project items always win over reorder-slot overlaps.
 */
export function findHoveredTarget(
  targets: DropTargetRegistration[],
  pointer: Pointer,
): DropTargetRegistration | null {
  const kindPriority: Record<string, number> = {
    'project': 0,
    'inbox': 1,
    'reorder-slot': 2,
  }

  let best: DropTargetRegistration | null = null
  let bestPriority = Infinity

  for (const target of targets) {
    const rect = target.el.getBoundingClientRect()
    if (
      pointer.x >= rect.left
      && pointer.x <= rect.right
      && pointer.y >= rect.top
      && pointer.y <= rect.bottom
    ) {
      const priority = kindPriority[target.kind] ?? 3
      if (priority < bestPriority) {
        best = target
        bestPriority = priority
      }
    }
  }

  return best
}

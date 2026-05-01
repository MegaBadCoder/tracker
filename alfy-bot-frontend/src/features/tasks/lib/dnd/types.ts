import type { Task } from '@/features/tasks/model/types'

export interface DragSession {
  task: Task
  pointerType: 'mouse' | 'touch' | 'pen'
  /** Bounding rect of the card element at drag start */
  originRect: DOMRect
  /** Offset from pointer to ghost top-left corner */
  ghostOffset: { x: number, y: number }
  /** pointerId for setPointerCapture */
  pointerId: number
}

export type DropTargetKind = 'project' | 'inbox' | 'reorder-slot'

export interface DropTargetRegistration {
  id: string
  kind: DropTargetKind
  el: HTMLElement
  projectId?: string
}

export interface ReorderListRegistration {
  /** 'inbox' | 'project:<projectId>' */
  scope: string
  /**
   * Returns null when the host's list element is currently unmounted/hidden
   * (e.g. ProjectView reused across navigation, but the flat-list branch is
   * not in the current DOM). Engine must skip such registrations during hit-test.
   */
  listEl: HTMLElement | null
  getItems: () => { id: string, el: HTMLElement }[]
}

export interface Pointer {
  x: number
  y: number
}

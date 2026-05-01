import type {
  DragSession,
  DropTargetRegistration,
  Pointer,
  ReorderListRegistration,
} from './types'
import { reactive, readonly } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { findHoveredTarget } from './hit-test'
import { computeInsertionIndex } from './use-reorder-list'

interface DndState {
  active: DragSession | null
  pointer: Pointer
  hoveredTarget: DropTargetRegistration | null
  hoveredList: ReorderListRegistration | null
  insertionIndex: number | null
}

// Module-level singleton — only one drag active at a time.
let scrollRafId: number | null = null

const state = reactive<DndState>({
  active: null,
  pointer: { x: 0, y: 0 },
  hoveredTarget: null,
  hoveredList: null,
  insertionIndex: null,
})

const dropTargets: DropTargetRegistration[] = []
const reorderLists: ReorderListRegistration[] = []

function collectDomDropTargets(): DropTargetRegistration[] {
  // Scan DOM at drag time (not at mount), so we always pick up the visible
  // copy of slot-rendered elements (e.g. desktop vs hidden mobile sidebar).
  // Elements opt in via `data-drop-kind="project"|"inbox"` and `data-project-id`.
  const nodes = document.querySelectorAll<HTMLElement>('[data-drop-kind]')
  const out: DropTargetRegistration[] = []
  nodes.forEach((el) => {
    const kind = el.dataset.dropKind as 'project' | 'inbox' | undefined
    if (kind !== 'project' && kind !== 'inbox')
      return
    // Skip elements that are visually hidden (display:none ancestor → rect 0).
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0)
      return
    out.push({
      id: kind === 'inbox' ? 'inbox' : `project:${el.dataset.projectId}`,
      kind,
      el,
      projectId: el.dataset.projectId,
    })
  })
  return out
}

function updateHitTest(pointer: Pointer): void {
  // Refresh from DOM each tick — handles dynamic visibility, scroll, slot dup.
  const live = collectDomDropTargets()
  state.hoveredTarget = findHoveredTarget(live, pointer)

  // Find which reorder list contains the pointer.
  let foundList: ReorderListRegistration | null = null
  for (const list of reorderLists) {
    const el = list.listEl
    if (!el)
      continue
    const rect = el.getBoundingClientRect()
    if (
      pointer.x >= rect.left
      && pointer.x <= rect.right
      && pointer.y >= rect.top
      && pointer.y <= rect.bottom
    ) {
      foundList = list
      break
    }
  }

  state.hoveredList = foundList

  if (foundList) {
    const items = foundList.getItems().map(item => ({
      id: item.id,
      rect: item.el.getBoundingClientRect(),
    }))
    state.insertionIndex = computeInsertionIndex(pointer.y, items)
  }
  else {
    state.insertionIndex = null
  }
}

function onPointerMove(event: PointerEvent): void {
  const pointer: Pointer = { x: event.clientX, y: event.clientY }
  state.pointer = pointer
  updateHitTest(pointer)
}

function onPointerUp(_event: PointerEvent): void {
  commit()
}

function onPointerCancel(_event: PointerEvent): void {
  cancel()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    cancel()
  }
}

function addWindowListeners(): void {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('keydown', onKeyDown)
}

function removeWindowListeners(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onKeyDown)
}

function clearState(): void {
  state.active = null
  state.hoveredTarget = null
  state.hoveredList = null
  state.insertionIndex = null
}

function tickAutoScroll(): void {
  if (!state.active) {
    scrollRafId = null
    return
  }
  const y = state.pointer.y
  const h = window.innerHeight
  if (y < 80) {
    window.scrollBy({ top: -10 })
  }
  else if (y > h - 80) {
    window.scrollBy({ top: 10 })
  }
  scrollRafId = requestAnimationFrame(tickAutoScroll)
}

function stopAutoScroll(): void {
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
}

function register(target: DropTargetRegistration): void {
  const idx = dropTargets.findIndex(t => t.id === target.id)
  if (idx !== -1) {
    dropTargets[idx] = target
  }
  else {
    dropTargets.push(target)
  }
}

function unregister(id: string): void {
  const idx = dropTargets.findIndex(t => t.id === id)
  if (idx !== -1)
    dropTargets.splice(idx, 1)
}

function registerReorderList(list: ReorderListRegistration): void {
  const idx = reorderLists.findIndex(l => l.scope === list.scope)
  if (idx !== -1) {
    reorderLists[idx] = list
  }
  else {
    reorderLists.push(list)
  }
}

function unregisterReorderList(scope: string): void {
  const idx = reorderLists.findIndex(l => l.scope === scope)
  if (idx !== -1)
    reorderLists.splice(idx, 1)
}

function start(session: DragSession, initialPointer: Pointer): void {
  if (state.active !== null) {
    // Invariant: only one drag at a time. Cancel any existing drag.
    cancel()
  }

  state.active = session
  state.pointer = initialPointer
  updateHitTest(initialPointer)
  addWindowListeners()
  ;(window as any).Telegram?.WebApp?.disableVerticalSwipes?.()
  scrollRafId = requestAnimationFrame(tickAutoScroll)
}

function commit(): void {
  if (!state.active) {
    cancel()
    return
  }

  ;(window as any).Telegram?.WebApp?.enableVerticalSwipes?.()
  stopAutoScroll()

  const session = state.active
  const target = state.hoveredTarget
  const list = state.hoveredList
  const insertionIdx = state.insertionIndex

  removeWindowListeners()
  clearState()

  if (!target && !list) {
    // No drop target hit — no-op, store retains original state.
    return
  }

  const taskStore = useTaskStore()
  const task = session.task

  const doCommit = async (): Promise<void> => {
    // Sidebar drop targets (move-to-project / move-to-inbox) win over reorder.
    // If pointer was over a project/inbox link in sidebar at drop time, that's
    // an explicit "move" intent, not a "reorder".
    if (target) {
      if (target.kind === 'project') {
        // Compute order = max order among uncategorized tasks in target project + 1.
        const projectTasks = taskStore.tasks.filter(
          t => t.projectId === target.projectId && (t.columnId === null || t.columnId === undefined),
        )
        const maxOrder = projectTasks.reduce((max, t) => Math.max(max, t.order ?? 0), 0)
        await taskStore.moveTask(task.id, target.projectId!, { columnId: null, order: maxOrder + 1 })
        return
      }
      if (target.kind === 'inbox') {
        await taskStore.moveTask(task.id, null, {})
        return
      }
      // 'reorder-slot' is a virtual drop slot inside a list — fall through to list logic below.
    }

    if (list) {
      // Reorder within a flat list (inbox or project-list-without-columns).
      const scope = list.scope
      const items = list.getItems()
      const orderedIds = items.map(i => i.id)

      // Remove task from its current position, insert at insertionIdx.
      const withoutTask = orderedIds.filter(id => id !== task.id)
      const clampedIdx = Math.min(insertionIdx ?? withoutTask.length, withoutTask.length)
      withoutTask.splice(clampedIdx, 0, task.id)

      if (scope === 'inbox') {
        await taskStore.reorderInboxTasks(withoutTask)
      }
      else if (scope.startsWith('project:')) {
        const projectId = scope.slice('project:'.length)
        await taskStore.reorderTasks(projectId, withoutTask)
      }
      else {
        console.error('DnD commit failed: unknown reorder scope', scope)
      }
    }
  }

  doCommit().catch((err) => {
    console.error('DnD commit failed', err)
  })
}

function cancel(): void {
  ;(window as any).Telegram?.WebApp?.enableVerticalSwipes?.()
  stopAutoScroll()
  removeWindowListeners()
  clearState()
}

export function useTaskDnd() {
  return {
    state: readonly(state) as Readonly<DndState>,
    register,
    unregister,
    registerReorderList,
    unregisterReorderList,
    start,
    commit,
    cancel,
  }
}

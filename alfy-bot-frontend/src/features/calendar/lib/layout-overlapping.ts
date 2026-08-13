import type { CalendarEvent } from '../model/types'

/** Visual min height is 20px; hour row is 60px → 20 minutes. */
export const MIN_VISUAL_MINUTES = 20

export interface EventColumn {
  col: number
  cols: number
}

function visualEnd(event: CalendarEvent): number {
  return event.startMinutes + Math.max(event.durationMinutes, MIN_VISUAL_MINUTES)
}

function layoutGroup(
  group: CalendarEvent[],
  result: Map<string, EventColumn>,
): void {
  const columns: CalendarEvent[][] = []
  const colOf = new Map<string, number>()

  for (const event of group) {
    let placed = false
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i]![columns[i]!.length - 1]!
      if (visualEnd(last) <= event.startMinutes) {
        columns[i]!.push(event)
        colOf.set(event.taskId, i)
        placed = true
        break
      }
    }
    if (!placed) {
      colOf.set(event.taskId, columns.length)
      columns.push([event])
    }
  }

  const cols = columns.length
  for (const event of group) {
    result.set(event.taskId, { col: colOf.get(event.taskId)!, cols })
  }
}

/** Outlook-style columns: overlapping events share width, touching ones stay full-width. */
export function assignEventColumns(events: CalendarEvent[]): Map<string, EventColumn> {
  const result = new Map<string, EventColumn>()
  if (events.length === 0) return result

  const sorted = [...events].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes
      || b.durationMinutes - a.durationMinutes
      || a.taskId.localeCompare(b.taskId),
  )

  let group: CalendarEvent[] = []
  let groupEnd = -1

  const flush = () => {
    if (group.length === 0) return
    layoutGroup(group, result)
    group = []
    groupEnd = -1
  }

  for (const event of sorted) {
    if (group.length > 0 && event.startMinutes >= groupEnd) flush()
    group.push(event)
    groupEnd = Math.max(groupEnd, visualEnd(event))
  }
  flush()
  return result
}

const INSET_PX = 2

export function eventColumnStyle(layout: EventColumn): Record<string, string | number> {
  if (layout.cols <= 1) {
    return { left: `${INSET_PX}px`, right: `${INSET_PX}px`, zIndex: 1 }
  }
  const leftPct = (layout.col / layout.cols) * 100
  const widthPct = 100 / layout.cols
  return {
    left: `calc(${leftPct}% + ${INSET_PX}px)`,
    width: `calc(${widthPct}% - ${INSET_PX * 2}px)`,
    right: 'auto',
    zIndex: layout.col + 1,
  }
}

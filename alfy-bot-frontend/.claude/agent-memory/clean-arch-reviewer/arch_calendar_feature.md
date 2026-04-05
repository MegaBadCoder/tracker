---
name: Calendar feature architecture
description: Layer structure and DnD patterns observed in the calendar feature
type: project
---

## Layer mapping (calendar feature)

- `features/calendar/model/types.ts` — domain types (CalendarEvent, CalendarDropPayload). NOTE: CalendarEvent embeds the raw `Task` object — shallow coupling to tasks domain.
- `features/calendar/lib/` — composables and pure helpers. Use-case / application layer.
  - `use-calendar-dnd.ts` — HTML5 drag-and-drop state (startDrag / draggedTaskId)
  - `use-infinite-days.ts` — virtual scrolling geometry (dayOffset, visibleDays, dateRange)
  - `calendar-events.ts` — mapping tasks → CalendarEvent (adapter-level transform)
  - `calendar-styles.ts` — pure style helper
  - `week.ts` — date utilities
- `features/calendar/ui/` — presentation layer
  - WeeklyCalendar.vue — top-level orchestrator; owns task store and commits mutations
  - HourGrid.vue — renders time gutter + DayColumn children; owns `now` clock interval
  - DayColumn.vue — single-day column; handles HTML5 drop
  - CalendarEventBlock.vue — individual event card; currently owns pointer-drag logic self-contained

## Key design observations

- Two DnD systems coexist: HTML5 (DayColumn/@drop) for cross-day via AllDaySection, and pointer events (CalendarEventBlock) for same-day time adjustment.
- `moved` event currently only carries (taskId, startMinutes) — no date — so cross-day with pointer events requires a new payload shape.
- `dayOffset(date)` is a pure function living in use-infinite-days; it maps Date → absolute pixel X. Its inverse (pixelX → Date) does not yet exist but is needed for cross-day DnD.
- WeeklyCalendar passes `dayOffset` as a prop to HourGrid (and down to DayColumn) — geometry is shared top-down.
- `gridRef` is passed from WeeklyCalendar into HourGrid/DayColumn so children can compute scroll-adjusted Y positions.

## Sidebar refactor (2026-04-04): Calendar moved to tasks sub-route

- CalendarView is now at `/tasks/calendar` (nested under TasksLayout, which is a pass-through `<RouterView />`).
- CalendarView imports AppHeader from `@/components/AppHeader.vue` — that file does not exist. Open build error.
- AppLayout resolves section-specific nav links by checking `route.path.startsWith('/tasks')` and importing tasksNavLinks directly. Adding new sections requires editing AppLayout.

## Proposed cross-day pointer DnD

- Proposed: CalendarEventBlock emits `grab`, HourGrid captures pointer + renders overlay.
- Violation risk: if drag state lives in HourGrid directly, it mixes geometry orchestration with interaction state — two distinct concerns.
- Recommended: extract a `use-pointer-dnd.ts` composable that owns (dragState, onGrab, onMove, onRelease) and is consumed by HourGrid.
- The overlay card rendered during drag should mirror CalendarEventBlock visually but must NOT be CalendarEventBlock itself (CalendarEventBlock must not know it is being ghosted).

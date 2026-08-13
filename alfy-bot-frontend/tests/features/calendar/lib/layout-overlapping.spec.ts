import { describe, it, expect } from 'vitest'
import {
  assignEventColumns,
  eventColumnStyle,
  MIN_VISUAL_MINUTES,
} from '@/features/calendar/lib/layout-overlapping'
import type { CalendarEvent } from '@/features/calendar/model/types'
import type { Task } from '@/features/tasks/model/types'

const makeTask = (id: string): Task => ({
  id,
  title: id,
  completed: false,
  pomodoroCompleted: 0,
})

const ev = (
  taskId: string,
  startMinutes: number,
  durationMinutes: number,
): CalendarEvent => ({
  taskId,
  title: taskId,
  date: new Date(2026, 3, 8),
  startMinutes,
  durationMinutes,
  isAllDay: false,
  task: makeTask(taskId),
  completed: false,
  resizable: true,
})

describe('assignEventColumns', () => {
  it('одиночное событие: одна колонка на всю ширину', () => {
    const layout = assignEventColumns([ev('a', 600, 60)])
    expect(layout.get('a')).toEqual({ col: 0, cols: 1 })
  })

  it('два пересекающихся: две колонки', () => {
    const layout = assignEventColumns([
      ev('a', 600, 60),
      ev('b', 630, 60),
    ])
    expect(layout.get('a')).toEqual({ col: 0, cols: 2 })
    expect(layout.get('b')).toEqual({ col: 1, cols: 2 })
  })

  it('стык конец=начало: не пересекаются', () => {
    const layout = assignEventColumns([
      ev('a', 600, 60),
      ev('b', 660, 60),
    ])
    expect(layout.get('a')).toEqual({ col: 0, cols: 1 })
    expect(layout.get('b')).toEqual({ col: 0, cols: 1 })
  })

  it('C переиспользует колонку B после её конца', () => {
    const layout = assignEventColumns([
      ev('a', 600, 120),
      ev('b', 600, 60),
      ev('c', 660, 60),
    ])
    expect(layout.get('a')?.cols).toBe(2)
    expect(layout.get('b')).toEqual({ col: 1, cols: 2 })
    expect(layout.get('c')).toEqual({ col: 1, cols: 2 })
  })

  it('короткие события ближе MIN_VISUAL_MINUTES визуально пересекаются', () => {
    const layout = assignEventColumns([
      ev('a', 600, 5),
      ev('b', 600 + MIN_VISUAL_MINUTES - 1, 5),
    ])
    expect(layout.get('a')?.cols).toBe(2)
    expect(layout.get('b')?.cols).toBe(2)
  })
})

describe('eventColumnStyle', () => {
  it('одна колонка: left/right inset, без width', () => {
    expect(eventColumnStyle({ col: 0, cols: 1 })).toEqual({
      left: '2px',
      right: '2px',
      zIndex: 1,
    })
  })

  it('вторая из двух: половина ширины со сдвигом', () => {
    const style = eventColumnStyle({ col: 1, cols: 2 })
    expect(style.left).toBe('calc(50% + 2px)')
    expect(style.width).toBe('calc(50% - 4px)')
    expect(style.right).toBe('auto')
  })
})

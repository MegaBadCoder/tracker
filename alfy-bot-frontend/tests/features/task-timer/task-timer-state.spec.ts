import { describe, expect, it } from 'vitest'
import { getTaskTimerState } from '@/features/task-timer/lib/task-timer-state'

const ticking = { activeTaskId: 'task-1', phase: 1, isActive: true }

describe('getTaskTimerState', () => {
  it('таймер тикает по этой задаче → running', () => {
    expect(getTaskTimerState('task-1', ticking)).toBe('running')
  })

  it('сессия есть, но не тикает → paused', () => {
    expect(getTaskTimerState('task-1', { ...ticking, isActive: false })).toBe('paused')
  })

  it('таймер идёт по другой задаче → idle', () => {
    expect(getTaskTimerState('task-2', ticking)).toBe('idle')
  })

  it('задача не выбрана → idle', () => {
    expect(getTaskTimerState('task-1', { ...ticking, activeTaskId: null })).toBe('idle')
  })

  it('сессия не заведена (phase 0) → idle, даже если id совпал', () => {
    expect(getTaskTimerState('task-1', { ...ticking, phase: 0 })).toBe('idle')
  })
})

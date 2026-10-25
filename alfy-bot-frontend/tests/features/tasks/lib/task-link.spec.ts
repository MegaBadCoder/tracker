import { describe, expect, it } from 'vitest'
import { taskLinkPath } from '@/features/tasks/lib/task-link'

const id = 'e797ece0-197b-452a-8cc1-123456789012'

describe('taskLinkPath', () => {
  it('строит постоянный путь задачи', () => {
    expect(taskLinkPath(id)).toBe(`/tasks/${id}`)
  })

  it.each(['', 'temp-1', `${id}:2026-10-18`, `overdue-${id}`, '../settings', '//example.com', `${id}/edit`])('не создаёт ссылку для %s', (value) => {
    expect(taskLinkPath(value)).toBeNull()
  })
})

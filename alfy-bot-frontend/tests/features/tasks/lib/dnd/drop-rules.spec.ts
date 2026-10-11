import { describe, expect, it } from 'vitest'
import { canDropTask } from '@/features/tasks/lib/dnd/drop-rules'

describe('canDropTask', () => {
  it('запрещает перенос из agile-проекта в обычный проект', () => {
    expect(canDropTask('agile', 'simple')).toBe(false)
  })

  it('запрещает перенос из agile-проекта во Входящие', () => {
    expect(canDropTask('agile', 'inbox')).toBe(false)
  })

  it('разрешает перенос из agile-проекта в другой agile-проект', () => {
    expect(canDropTask('agile', 'agile')).toBe(true)
  })

  it('разрешает перенос из обычного проекта в agile-проект', () => {
    expect(canDropTask('simple', 'agile')).toBe(true)
  })

  it('разрешает перенос из Входящих в agile-проект', () => {
    expect(canDropTask(null, 'agile')).toBe(true)
  })

  it('разрешает перенос из обычного проекта в обычный проект', () => {
    expect(canDropTask('simple', 'simple')).toBe(true)
  })

  it('разрешает перенос из обычного проекта во Входящие', () => {
    expect(canDropTask('simple', 'inbox')).toBe(true)
  })
})

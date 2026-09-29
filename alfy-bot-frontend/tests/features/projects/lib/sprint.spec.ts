import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import {
  daysLeft,
  defaultCompleteTarget,
  sprintDeletionMessage,
  sprintEndFromDuration,
  sprintProgress,
  sprintTasks,
} from '@/features/projects/lib/sprint'

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planned',
    completedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    ...overrides,
  }
}

describe('daysLeft', () => {
  it('в последний день спринта возвращает 0', () => {
    expect(daysLeft('2026-10-18', new Date(2026, 9, 18, 23, 30))).toBe(0)
  })

  it('за день до конца возвращает 1', () => {
    expect(daysLeft('2026-10-18', new Date(2026, 9, 17, 0, 5))).toBe(1)
  })

  it('на следующий день после конца возвращает -1', () => {
    expect(daysLeft('2026-10-18', new Date(2026, 9, 19, 12))).toBe(-1)
  })

  it('считает дни через границу месяца', () => {
    expect(daysLeft('2026-11-02', new Date(2026, 9, 30))).toBe(3)
  })
})

describe('defaultCompleteTarget', () => {
  it('возвращает id первого запланированного спринта по order', () => {
    const planned = [
      makeSprint({ id: 'late', order: 5 }),
      makeSprint({ id: 'early', order: 1 }),
      makeSprint({ id: 'mid', order: 3 }),
    ]

    expect(defaultCompleteTarget(planned)).toBe('early')
  })

  it('без запланированных спринтов возвращает backlog', () => {
    expect(defaultCompleteTarget([])).toBe('backlog')
  })
})

describe('sprintProgress', () => {
  it('считает выполненные и все задачи спринта', () => {
    const tasks = [
      makeTask({ id: 'a', sprintId: 's1', completed: true }),
      makeTask({ id: 'b', sprintId: 's1', completed: false }),
      makeTask({ id: 'c', sprintId: 's1', completed: true }),
      makeTask({ id: 'd', sprintId: 's2', completed: true }),
      makeTask({ id: 'e', sprintId: null, completed: true }),
    ]

    expect(sprintProgress(tasks, 's1')).toEqual({ done: 2, total: 3 })
  })

  it('для пустого спринта возвращает нули', () => {
    expect(sprintProgress([], 's1')).toEqual({ done: 0, total: 0 })
  })
})

describe('sprintTasks', () => {
  const tasks = [
    makeTask({ id: 'in-sprint', sprintId: 's1' }),
    makeTask({ id: 'in-other-sprint', sprintId: 's2' }),
    makeTask({ id: 'backlog-null', sprintId: null }),
    makeTask({ id: 'backlog-undefined' }),
    makeTask({ id: 'foreign-project', projectId: 'proj-2', sprintId: null }),
    makeTask({ id: 'foreign-sprint-task', projectId: 'proj-2', sprintId: 's1' }),
  ]

  it('null возвращает бэклог проекта без задач спринтов и чужих проектов', () => {
    const ids = sprintTasks(tasks, null, 'proj-1').map(t => t.id)

    expect(ids).toEqual(['backlog-null', 'backlog-undefined'])
  })

  it('с id спринта возвращает задачи этого спринта в своём проекте', () => {
    const ids = sprintTasks(tasks, 's1', 'proj-1').map(t => t.id)

    expect(ids).toEqual(['in-sprint'])
  })
})

describe('sprintEndFromDuration', () => {
  it('двухнедельный спринт с понедельника заканчивается в воскресенье через 13 дней', () => {
    const end = sprintEndFromDuration(new Date(2026, 9, 5), 2)

    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(9)
    expect(end.getDate()).toBe(18)
  })

  it('однонедельный спринт заканчивается через 6 дней', () => {
    const end = sprintEndFromDuration(new Date(2026, 9, 28), 1)

    expect(end.getMonth()).toBe(10)
    expect(end.getDate()).toBe(3)
  })

  it('не мутирует переданную дату', () => {
    const start = new Date(2026, 9, 5)
    sprintEndFromDuration(start, 4)

    expect(start.getDate()).toBe(5)
  })
})

describe('sprintDeletionMessage', () => {
  const sprint = makeSprint({ name: 'Спринт 2' })

  it('без задач — только вопрос', () => {
    expect(sprintDeletionMessage(sprint, 0)).toBe('Удалить „Спринт 2“?')
  })

  it('одна задача', () => {
    expect(sprintDeletionMessage(sprint, 1)).toBe('Удалить „Спринт 2“? 1 задача вернётся в бэклог.')
  })

  it('три задачи', () => {
    expect(sprintDeletionMessage(sprint, 3)).toBe('Удалить „Спринт 2“? 3 задачи вернутся в бэклог.')
  })

  it('пять задач', () => {
    expect(sprintDeletionMessage(sprint, 5)).toBe('Удалить „Спринт 2“? 5 задач вернутся в бэклог.')
  })
})

import { http, HttpResponse, delay } from 'msw'
import type { Task } from '@/features/tasks/model/types'

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Сверстать главную страницу',
    description: 'Создать адаптивную верстку главной страницы по макету из Figma',
    completed: false,
    priority: 'high',
    tags: ['frontend', 'верстка'],
    isPomodoroTask: true,
    pomodoroCompleted: 2,
    pomodoroCount: 6,
    pomodoroDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    dueDate: new Date('2026-03-12'),
  },
  {
    id: '2',
    title: 'Написать unit-тесты для useTasks',
    description: 'Покрыть тестами основные сценарии: создание, удаление, переключение статуса',
    completed: false,
    priority: 'medium',
    tags: ['тесты', 'vitest'],
    isPomodoroTask: false,
    pomodoroCompleted: 0,
  },
  {
    id: '3',
    title: 'Настроить CI/CD пайплайн',
    completed: true,
    priority: 'high',
    tags: ['devops'],
    isPomodoroTask: false,
    pomodoroCompleted: 0,
  },
  {
    id: '4',
    title: 'Рефакторинг компонента TaskCard',
    description: 'Разбить на подкомпоненты, вынести логику в composable',
    completed: false,
    priority: 'low',
    tags: ['рефакторинг'],
    isPomodoroTask: true,
    pomodoroCompleted: 0,
    pomodoroCount: 4,
    pomodoroDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
  },
  {
    id: '5',
    title: 'Добавить темную тему',
    description: 'Реализовать переключение между светлой и темной темами',
    completed: false,
    priority: 'medium',
    tags: ['UI', 'дизайн'],
    isPomodoroTask: false,
    pomodoroCompleted: 0,
    checklist: {
      items: [
        { id: 'cl-1', text: 'CSS переменные для цветов', completed: true, order: 0 },
        { id: 'cl-2', text: 'Переключатель в хедере', completed: false, order: 1 },
        { id: 'cl-3', text: 'Сохранение в localStorage', completed: false, order: 2 },
      ]
    }
  },
  {
    id: '6',
    title: 'Купить продукты',
    completed: true,
    priority: 'low',
    location: 'Магазин у дома',
    isPomodoroTask: false,
    pomodoroCompleted: 0,
  },
]

function serializeTask(task: Task) {
  return {
    ...task,
    dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate,
    deadline: task.deadline instanceof Date ? task.deadline.toISOString() : task.deadline,
  }
}

let tasks: Task[] = structuredClone(mockTasks)
let nextId = tasks.length + 1

export const taskHandlers = [
  http.get('/api/tasks', async () => {
    await delay(300)
    return HttpResponse.json(tasks.map(serializeTask))
  }),

  http.post('/api/tasks', async ({ request }) => {
    await delay(200)
    const body = await request.json() as Partial<Task>

    const newTask: Task = {
      id: String(nextId++),
      title: body.title || '',
      completed: false,
      pomodoroCompleted: 0,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate as unknown as string) : undefined,
      deadline: body.deadline ? new Date(body.deadline as unknown as string) : undefined,
      priority: body.priority,
      location: body.location,
      tags: body.tags,
      isPomodoroTask: body.isPomodoroTask ?? false,
      pomodoroCount: body.pomodoroCount,
      pomodoroDuration: body.pomodoroDuration,
      shortBreak: body.shortBreak,
      longBreak: body.longBreak,
      longBreakInterval: body.longBreakInterval,
      checklist: body.checklist,
      parentId: body.parentId,
      goalIds: body.goalIds ?? [],
    }

    tasks.unshift(newTask)
    return HttpResponse.json(serializeTask(newTask), { status: 201 })
  }),

  http.put('/api/tasks/:id/goals', async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as { goalIds?: number[] }
    const index = tasks.findIndex(t => t.id === id)
    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    tasks[index] = { ...tasks[index]!, goalIds: body.goalIds ?? [] }
    return HttpResponse.json({ goalIds: tasks[index]!.goalIds })
  }),

  http.patch('/api/tasks/:id', async ({ params, request }) => {
    await delay(150)
    const { id } = params
    const updates = await request.json() as Partial<Task>

    const index = tasks.findIndex(t => t.id === id)
    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const existing = tasks[index]!
    tasks[index] = { ...existing, ...updates }

    if (updates.dueDate) tasks[index]!.dueDate = new Date(updates.dueDate as unknown as string)
    if (updates.deadline) tasks[index]!.deadline = new Date(updates.deadline as unknown as string)

    return HttpResponse.json(serializeTask(tasks[index]!))
  }),

  http.delete('/api/tasks/:id', async ({ params }) => {
    await delay(150)
    const { id } = params
    const index = tasks.findIndex(t => t.id === id)

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    tasks.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]

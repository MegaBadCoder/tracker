import { describe, expect, it, vi } from 'vitest'
import { useAgileDnd } from '@/features/projects/lib/use-agile-dnd'

function makeTaskStore() {
  return {
    moveTask: vi.fn(),
    reorderTasks: vi.fn(),
  } as any
}

describe('useAgileDnd', () => {
  describe('onTaskChange', () => {
    it('при добавлении вызывает moveTask с columnId и groupId ячейки', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { added: { element: { id: 'task-1' }, newIndex: 2 } },
        'col-2',
        'epic-1',
        'proj-1',
        [{ id: 'task-1' }],
      )

      expect(taskStore.moveTask).toHaveBeenCalledWith('task-1', 'proj-1', {
        columnId: 'col-2',
        groupId: 'epic-1',
        order: 2,
      })
    })

    it('дорожка «Без колонки» передаёт columnId: null', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { added: { element: { id: 'task-1' }, newIndex: 0 } },
        null,
        'epic-1',
        'proj-1',
        [{ id: 'task-1' }],
      )

      expect(taskStore.moveTask).toHaveBeenCalledWith('task-1', 'proj-1', {
        columnId: null,
        groupId: 'epic-1',
        order: 0,
      })
    })

    it('блок «Без эпика» передаёт groupId: null', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { added: { element: { id: 'task-1' }, newIndex: 0 } },
        'col-1',
        null,
        'proj-1',
        [{ id: 'task-1' }],
      )

      expect(taskStore.moveTask).toHaveBeenCalledWith('task-1', 'proj-1', {
        columnId: 'col-1',
        groupId: null,
        order: 0,
      })
    })

    it('бэклог (groupId: undefined) не передаёт groupId в moveTask — иначе стирается эпик', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { added: { element: { id: 'task-1' }, newIndex: 0 } },
        null,
        undefined,
        'proj-1',
        [{ id: 'task-1' }],
      )

      expect(taskStore.moveTask).toHaveBeenCalledWith('task-1', 'proj-1', {
        columnId: null,
        order: 0,
      })
      expect(taskStore.moveTask.mock.calls[0][2]).not.toHaveProperty('groupId')
    })

    it('при добавлении с несколькими задачами также реордерит ячейку', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { added: { element: { id: 'task-1' }, newIndex: 1 } },
        'col-1',
        'story-1',
        'proj-1',
        [{ id: 'task-2' }, { id: 'task-1' }],
      )

      expect(taskStore.reorderTasks).toHaveBeenCalledWith('proj-1', ['task-2', 'task-1'], 'col-1')
    })

    it('при перестановке внутри ячейки реордерит по её задачам', () => {
      const taskStore = makeTaskStore()
      const { onTaskChange } = useAgileDnd(taskStore)

      onTaskChange(
        { moved: { element: { id: 'task-1' }, newIndex: 0 } },
        'col-1',
        'epic-1',
        'proj-1',
        [{ id: 'task-1' }, { id: 'task-2' }],
      )

      expect(taskStore.reorderTasks).toHaveBeenCalledWith('proj-1', ['task-1', 'task-2'], 'col-1')
      expect(taskStore.moveTask).not.toHaveBeenCalled()
    })
  })
})

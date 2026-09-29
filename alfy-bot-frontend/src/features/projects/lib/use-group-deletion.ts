import type { BoardGroupNode } from '../model/types'
import { useConfirm } from '@/composables/useConfirm'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useGroupStore } from '../model/group-store'
import { deletionImpact, groupDeletionMessage, groupTaskIds } from './group-tree'

/**
 * Удаление эпика/истории с подтверждением: один и тот же текст подтверждения
 * и один и тот же локальный эффект (открепление задач группы — `groupId =
 * null`) для доски и карточки группы, чтобы они не разошлись.
 */
export function useGroupDeletion() {
  const { confirm } = useConfirm()
  const groupStore = useGroupStore()
  const taskStore = useTaskStore()

  async function deleteGroupWithConfirm(projectId: string, group: BoardGroupNode): Promise<boolean> {
    const impact = deletionImpact(group, taskStore.tasks)
    const confirmed = await confirm({
      title: group.type === 'epic' ? 'Удалить эпик?' : 'Удалить историю?',
      message: groupDeletionMessage(group, impact),
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'destructive',
    })
    if (!confirmed)
      return false

    try {
      await groupStore.deleteGroup(projectId, group.id)
    }
    catch (err) {
      console.error('Ошибка удаления группы:', err)
      return false
    }

    const clearedIds = new Set(groupTaskIds(group))
    taskStore.tasks = taskStore.tasks.map(t => (t.groupId && clearedIds.has(t.groupId)) ? { ...t, groupId: null } : t)
    return true
  }

  return { deleteGroupWithConfirm }
}

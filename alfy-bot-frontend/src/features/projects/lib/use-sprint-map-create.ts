import { ref } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { setGroupSprint } from '../api/groups-api'
import { useGroupStore } from '../model/group-store'
import { apiErrorMessage } from './api-error'
import { findGroup } from './group-tree'

/** Неизменяемый контекст создания; null в releaseId запрещает наследовать выпущенный релиз. */
export interface SprintMapCreateContext {
  projectId: string
  sprintId: string
  kind: 'task' | 'story' | 'epic'
  parentId: string | null
  releaseId: string | null
}

/** Создаёт дочернюю ветку в заданном спринте; повтор продолжает частично сохранённую операцию. */
export function useSprintMapCreate(context: SprintMapCreateContext, isClosed: () => boolean) {
  const groups = useGroupStore()
  const tasks = useTaskStore()
  const pending = ref(false)
  const error = ref('')
  const epicId = ref<string | null>(null)
  const storyId = ref<string | null>(null)
  async function submit(title: string, firstStoryTitle = ''): Promise<string | null> {
    if (pending.value)
      return null
    error.value = ''
    if (isClosed()) {
      error.value = 'Спринт закрыт. Создание недоступно.'
      return null
    }
    if (!title.trim() || (context.kind === 'epic' && !firstStoryTitle.trim())) {
      error.value = 'Заполните название и название первой истории.'
      return null
    }
    pending.value = true
    try {
      if (context.kind === 'task') {
        const task = await tasks.createTask({
          title: title.trim(),
          completed: false,
          projectId: context.projectId,
          sprintId: context.sprintId,
          groupId: context.parentId,
          releaseId: context.releaseId,
        })
        return task.id
      }
      if (context.kind === 'epic' && !epicId.value) {
        const epic = await groups.createGroup(context.projectId, { title: title.trim() })
        epicId.value = epic.id
      }
      if (!storyId.value) {
        const story = await groups.createGroup(context.projectId, {
          title: context.kind === 'epic' ? firstStoryTitle.trim() : title.trim(),
          parentId: epicId.value ?? context.parentId,
        })
        storyId.value = story.id
      }
      await setGroupSprint(context.projectId, storyId.value, context.sprintId)
      const story = findGroup(groups.groupsOf(context.projectId), storyId.value)
      if (story)
        story.sprintId = context.sprintId
      return storyId.value
    }
    catch (err) {
      error.value = apiErrorMessage(err, 'Не удалось создать ветку')
      return null
    }
    finally {
      pending.value = false
    }
  }
  return { pending, error, epicId, storyId, submit }
}

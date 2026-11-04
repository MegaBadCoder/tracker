import type { StoreGeneric } from 'pinia'
import type { Ref } from 'vue'
import { onScopeDispose } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useGroupStore } from './group-store'

const taskChanges = new Set(['createTask', 'updateTask', 'toggleTask', 'deleteTask', 'moveTask', 'reorderTasks', 'incrementPomodoro', 'updatePomodoroConfig', 'updateChecklist', 'setTaskGoals', 'materializeOccurrence'])
const groupChanges = new Set(['createGroup', 'updateGroup', 'deleteGroup', 'reorderGroups', 'toggleGroupDone'])

/** Вызывает обработчик после успешного изменения задач или историй текущего проекта; прекращает подписки при завершении области Vue. */
export function usePlanningInvalidation(projectId: Ref<string>, refresh: () => Promise<unknown>) {
  let active = true
  let queued = false

  function subscribe(store: StoreGeneric, names: Set<string>) {
    return store.$onAction(({ name, after }) => {
      if (!names.has(name))
        return
      const project = projectId.value
      after(() => {
        if (!active || queued || project !== projectId.value)
          return
        queued = true
        void Promise.resolve().then(() => {
          queued = false
          if (active && project === projectId.value)
            return refresh()
        })
      })
    }, true)
  }

  const unsubscribe = [subscribe(useTaskStore(), taskChanges), subscribe(useGroupStore(), groupChanges)]
  onScopeDispose(() => {
    active = false
    unsubscribe.forEach(stop => stop())
  })
}

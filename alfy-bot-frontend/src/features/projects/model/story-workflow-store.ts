import type { StoryWorkflowStatus } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchStoryWorkflow, saveStoryWorkflow } from '../api/planning-api'
import { apiErrorMessage } from '../lib/api-error'

export const useStoryWorkflowStore = defineStore('story-workflow', () => {
  const catalogs = ref<Record<string, StoryWorkflowStatus[]>>({})
  const errors = ref<Record<string, string>>({})
  const pending = new Map<string, Promise<void>>()

  function statusesOf(projectId: string) {
    return catalogs.value[projectId] ?? []
  }

  async function fetch(projectId: string): Promise<void> {
    if (pending.has(projectId))
      return pending.get(projectId)
    const request = (async () => {
      try {
        const { data } = await fetchStoryWorkflow(projectId)
        catalogs.value[projectId] = data.statuses
        delete errors.value[projectId]
      }
      catch (err) {
        errors.value[projectId] = apiErrorMessage(err, 'Не удалось загрузить статусы историй')
      }
      finally { pending.delete(projectId) }
    })()
    pending.set(projectId, request)
    return request
  }

  async function ensure(projectId: string) {
    if (!(projectId in catalogs.value))
      await fetch(projectId)
  }

  async function save(projectId: string, statuses: StoryWorkflowStatus[]) {
    const { data } = await saveStoryWorkflow(projectId, statuses)
    catalogs.value[projectId] = data.statuses
    delete errors.value[projectId]
  }

  return { catalogs, errors, statusesOf, fetch, ensure, save }
})

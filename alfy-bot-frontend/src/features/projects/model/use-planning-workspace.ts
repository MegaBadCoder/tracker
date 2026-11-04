import type { Ref } from 'vue'
import type { PlanningContext, PlanningProposal } from './planning-types'
import { computed, ref, watch } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import * as planningApi from '../api/planning-api'
import { apiErrorMessage } from '../lib/api-error'
import { useGroupStore } from './group-store'
import { useSprintStore } from './sprint-store'
import { usePlanningInvalidation } from './use-planning-invalidation'

export function usePlanningWorkspace(projectId: Ref<string>, sprintId: Ref<string | null>) {
  const context = ref<PlanningContext | null>(null)
  const proposal = ref<PlanningProposal | null>(null)
  const selectedTaskIds = ref<string[]>([])
  const selectedStoryIds = ref<string[]>([])
  const undoToken = ref<string | null>(null)
  const busy = ref(false)
  const loading = ref(false)
  const error = ref('')
  const notice = ref('')
  const tasks = useTaskStore()
  const groups = useGroupStore()
  const sprints = useSprintStore()
  let request = 0
  let scopeVersion = 0
  const hasSelection = computed(() => selectedTaskIds.value.length + selectedStoryIds.value.length > 0)

  async function load() {
    const version = ++request
    proposal.value = null
    loading.value = true
    error.value = ''
    try {
      const { data } = await planningApi.fetchPlanning(projectId.value, sprintId.value)
      if (version === request) {
        context.value = data
        const taskIds = new Set(data.tasks.map(task => task.id))
        const storyIds = new Set(data.stories.map(story => story.id))
        selectedTaskIds.value = selectedTaskIds.value.filter(id => taskIds.has(id))
        selectedStoryIds.value = selectedStoryIds.value.filter(id => storyIds.has(id))
      }
      return version === request
    }
    catch (err) {
      if (version === request)
        error.value = apiErrorMessage(err, 'Не удалось загрузить планирование')
      return false
    }
    finally {
      if (version === request)
        loading.value = false
    }
  }

  async function refresh(id = projectId.value, scope = scopeVersion) {
    await Promise.all([tasks.fetchTasks(), groups.fetchGroups(id), sprints.fetchSprints(id)])
    const failure = tasks.error || groups.error || sprints.error
    if (failure)
      throw new Error(`Изменения сохранены, но данные не обновлены: ${failure}`)
    if (scope === scopeVersion && !await load())
      throw new Error(error.value || 'Не удалось обновить планирование после сохранения')
  }

  async function run(action: () => Promise<void>) {
    const scope = scopeVersion
    if (busy.value)
      return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      await action()
    }
    catch (err) {
      if (scope === scopeVersion)
        error.value = apiErrorMessage(err, 'Не удалось сохранить изменения')
    }
    finally { busy.value = false }
  }

  async function move(target: string | null) {
    if (!hasSelection.value)
      return
    const id = projectId.value
    const scope = scopeVersion
    const payload = { taskIds: [...selectedTaskIds.value], storyIds: [...selectedStoryIds.value], sprintId: target }
    await run(async () => {
      const { data } = await planningApi.movePlanningItems(id, payload)
      if (scope !== scopeVersion)
        return
      undoToken.value = data.undoToken
      selectedTaskIds.value = []
      selectedStoryIds.value = []
      proposal.value = null
      await refresh(id, scope)
      if (scope !== scopeVersion)
        return
      notice.value = 'Перенос сохранён. Последнее действие можно отменить.'
    })
  }

  async function undo() {
    const token = undoToken.value
    if (!token)
      return
    const id = projectId.value
    const scope = scopeVersion
    await run(async () => {
      await planningApi.undoPlanningMove(id, token)
      if (scope !== scopeVersion)
        return
      undoToken.value = null
      await refresh(id, scope)
      if (scope !== scopeVersion)
        return
      notice.value = 'Последний перенос отменён'
    })
  }

  async function propose(budgetMinutes: number, goal: string) {
    const id = sprintId.value
    if (!id)
      return
    const project = projectId.value
    const scope = scopeVersion
    const contextVersion = request
    await run(async () => {
      const { data } = await planningApi.proposePlan(project, { sprintId: id, budgetMinutes, goal })
      if (scope !== scopeVersion || contextVersion !== request)
        return
      proposal.value = data
      selectedTaskIds.value = [...data.taskIds]
      selectedStoryIds.value = [...data.storyIds]
      notice.value = 'Предложение готово. Проверьте выбранные элементы перед переносом.'
    })
  }

  async function reorder(taskIds: string[], target: string | null) {
    const id = projectId.value
    const scope = scopeVersion
    await run(async () => {
      await planningApi.orderPlanningTasks(id, taskIds, target)
      await refresh(id, scope)
    })
  }

  usePlanningInvalidation(projectId, async () => {
    proposal.value = null
    await load()
  })

  watch([projectId, sprintId], () => {
    scopeVersion++
    context.value = null
    proposal.value = null
    selectedTaskIds.value = []
    selectedStoryIds.value = []
    undoToken.value = null
    notice.value = ''
    load()
  }, { immediate: true })

  return { context, proposal, selectedTaskIds, selectedStoryIds, undoToken, busy, loading, error, notice, hasSelection, load, refresh, run, move, undo, propose, reorder }
}

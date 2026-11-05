import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useBoardCollapseStore = defineStore('board-collapse', () => {
  const collapsed = useStorage<Record<string, string[]>>('alfy-board-collapsed-stories', {}, undefined, { flush: 'sync' })

  function isCollapsed(projectId: string, storyId: string): boolean {
    const ids = collapsed.value[projectId]
    return Array.isArray(ids) && ids.includes(storyId)
  }

  function setCollapsed(projectId: string, storyId: string, value: boolean) {
    const current = collapsed.value[projectId]
    const ids = new Set(Array.isArray(current) ? current : [])
    if (value)
      ids.add(storyId)
    else
      ids.delete(storyId)
    collapsed.value = { ...collapsed.value, [projectId]: [...ids] }
  }

  return { isCollapsed, setCollapsed }
})

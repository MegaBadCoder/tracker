import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import { buildTree } from '../lib/tree'
import type { Project, ProjectTreeNode, CreateProjectPayload, UpdateProjectPayload } from './types'

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const collapsedIds = ref(new Set<string>())
  const treeBusy = ref(false)
  const toggleExpanded = (id: string) => {
    if (collapsedIds.value.has(id)) collapsedIds.value.delete(id)
    else collapsedIds.value.add(id)
  }
  const loading = ref(false)
  const error = ref<string | null>(null)

  const projectTree = computed<ProjectTreeNode[]>(() => buildTree(projects.value))

  const projectMap = computed(() =>
    new Map(projects.value.map(p => [p.id, p])),
  )

  const fetchProjects = async () => {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.get<Project[]>('/projects')
      projects.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки проектов'
    } finally {
      loading.value = false
    }
  }

  const createProject = async (payload: CreateProjectPayload) => {
    const tempId = `temp-${Date.now()}`
    const tempProject: Project = {
      id: tempId,
      parentId: payload.parentId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      viewMode: payload.viewMode ?? 'list',
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      order: projects.value.length,
    }

    projects.value.push(tempProject)

    try {
      const { data } = await api.post<Project>('/projects', payload)
      const index = projects.value.findIndex(p => p.id === tempId)
      if (index !== -1) {
        projects.value[index] = data
      }
      return data
    } catch (err) {
      projects.value = projects.value.filter(p => p.id !== tempId)
      throw err
    }
  }

  const updateProject = async (id: string, payload: UpdateProjectPayload) => {
    const index = projects.value.findIndex(p => p.id === id)
    if (index === -1) return

    const current = projects.value[index]
    if (!current) return
    const previous = { ...current }
    projects.value[index] = { ...previous, ...payload } as Project

    try {
      await api.patch(`/projects/${id}`, payload)
      return projects.value[index]
    } catch (err) {
      projects.value[index] = previous
      throw err
    }
  }

  const reorderProjects = async (orderedIds: string[]) => {
    const previous = [...projects.value]

    projects.value = orderedIds
      .map((id, i) => {
        const p = projects.value.find(proj => proj.id === id)
        return p ? { ...p, order: i } : null
      })
      .filter((p): p is Project => p !== null)
    // Re-add projects not in orderedIds (e.g. children of other parents)
    const orderedSet = new Set(orderedIds)
    for (const p of previous) {
      if (!orderedSet.has(p.id)) {
        projects.value.push(p)
      }
    }

    try {
      await api.patch('/projects/reorder', { orderedIds })
    } catch (err) {
      projects.value = previous
      throw err
    }
  }

  const deleteProject = async (id: string) => {
    await api.delete(`/projects/${id}`)
    projects.value = projects.value
      .filter(project => project.id !== id)
      .map(project => project.parentId === id ? { ...project, parentId: null } : project)
    collapsedIds.value.delete(id)
  }

  return {
    projects,
    collapsedIds,
    treeBusy,
    toggleExpanded,
    loading,
    error,
    projectTree,
    projectMap,
    fetchProjects,
    createProject,
    updateProject,
    reorderProjects,
    deleteProject,
  }
})

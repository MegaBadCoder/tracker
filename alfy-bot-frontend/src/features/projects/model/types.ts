export type ViewMode = 'list' | 'board'

export interface Project {
  id: string
  parentId: string | null
  title: string
  description: string | null
  viewMode: ViewMode
  icon: string | null
  color: string | null
  order: number
}

export interface ProjectColumn {
  id: string
  projectId: string
  title: string
  order: number
  color: string | null
}

export interface ProjectTreeNode extends Project {
  children: ProjectTreeNode[]
}

export interface CreateProjectPayload {
  title: string
  parentId?: string | null
  description?: string | null
  viewMode?: ViewMode
  icon?: string | null
  color?: string | null
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>

export type ViewMode = 'list' | 'board'

export type ProjectType = 'simple' | 'agile'

export interface Project {
  id: string
  parentId: string | null
  title: string
  description: string | null
  viewMode: ViewMode
  type: ProjectType
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

export type GroupType = 'epic' | 'story'

export type GroupStatus = 'open' | 'done'

export interface BoardGroup {
  id: string
  projectId: string
  parentId: string | null
  type: GroupType
  title: string
  description: string | null
  status: GroupStatus
  completedAt: string | null
  color: string | null
  order: number
}

export interface BoardGroupNode extends BoardGroup {
  children: BoardGroupNode[]
}

export interface CreateGroupPayload {
  title: string
  parentId?: string | null
  description?: string | null
  color?: string | null
}

export type UpdateGroupPayload = Partial<CreateGroupPayload> & {
  status?: GroupStatus
}

export interface ProjectTreeNode extends Project {
  children: ProjectTreeNode[]
}

export interface CreateProjectPayload {
  title: string
  parentId?: string | null
  description?: string | null
  viewMode?: ViewMode
  type?: ProjectType
  icon?: string | null
  color?: string | null
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>

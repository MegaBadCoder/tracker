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
  startDate: string | null
  dueDate: string | null
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
  startDate?: string | null
  dueDate?: string | null
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

/** Статус спринта: `planned` — запланирован, `active` — идёт (не более одного на проект), `closed` — завершён. */
export type SprintStatus = 'planned' | 'active' | 'closed'

/** Спринт agile-проекта. Даты — `YYYY-MM-DD` (локальный календарный день), `null` пока спринт не запущен. */
export interface Sprint {
  id: string
  userId: number
  projectId: string
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
  completedAt: string | null
  order: number
  createdAt: string
  updatedAt: string
}

/** Без `name` сервер называет спринт «Спринт N». */
export interface CreateSprintPayload {
  name?: string
  goal?: string | null
}

export interface UpdateSprintPayload {
  name?: string
  goal?: string | null
  startDate?: string | null
  endDate?: string | null
}

/** Запуск спринта: `endDate` — последний день спринта включительно. */
export interface StartSprintPayload {
  startDate: string
  endDate: string
  goal?: string | null
}

/** Завершение спринта: `moveTo` — `'backlog'` или id запланированного спринта, куда уходят незавершённые задачи. */
export interface CompleteSprintPayload {
  moveTo: 'backlog' | string
}

/** Статус релиза: `planned` — запланирован, `released` — выпущен (только чтение). */
export type ReleaseStatus = 'planned' | 'released'

/** Релиз agile-проекта. Даты — `YYYY-MM-DD` (локальный календарный день), `releasedAt` — ISO-момент выпуска. */
export interface Release {
  id: string
  userId: number
  projectId: string
  name: string
  description: string | null
  startDate: string | null
  releaseDate: string | null
  status: ReleaseStatus
  releasedAt: string | null
  order: number
  createdAt: string
  updatedAt: string
}

/** Имя релиза обязательно: естественной нумерации, как у спринтов, нет. */
export interface CreateReleasePayload {
  name: string
  description?: string | null
  startDate?: string | null
  releaseDate?: string | null
}

export interface UpdateReleasePayload {
  name?: string
  description?: string | null
  startDate?: string | null
  releaseDate?: string | null
}

/** Выпуск релиза: `moveTo` — `'none'` или id запланированного релиза, куда уходят незавершённые задачи. */
export interface ReleaseActionPayload {
  moveTo: 'none' | string
}

/** Назначение всех задач группы (эпик вместе с историями либо история) в релиз. */
export interface AssignGroupToReleasePayload {
  groupId: string
}

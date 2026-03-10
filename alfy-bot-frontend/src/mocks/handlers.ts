import { authHandlers } from './handlers/auth'
import { taskHandlers } from './handlers/tasks'

export const handlers = [
  ...authHandlers,
  ...taskHandlers,
]

export function getPriorityEventClasses(priority?: string): string {
  switch (priority) {
    case 'high': return 'bg-red-500/25 border-red-500/40 text-white backdrop-blur-sm'
    case 'medium': return 'bg-amber-500/25 border-amber-500/40 text-white backdrop-blur-sm'
    case 'low': return 'bg-sky-500/25 border-sky-500/40 text-white backdrop-blur-sm'
    default: return 'bg-primary/25 border-primary/40 text-white backdrop-blur-sm'
  }
}

export const OVERDUE_EVENT_CLASSES = 'bg-red-500/40 border-red-500/70 text-white backdrop-blur-sm'

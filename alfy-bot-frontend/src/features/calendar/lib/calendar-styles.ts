export function getPriorityEventClasses(priority?: string): string {
  switch (priority) {
    case 'high': return 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400'
    case 'medium': return 'bg-yellow-500/15 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
    case 'low': return 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-400'
    default: return 'bg-primary/10 border-primary/30 text-primary'
  }
}

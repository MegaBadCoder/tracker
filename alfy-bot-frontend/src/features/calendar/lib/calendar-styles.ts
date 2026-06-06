export function getPriorityEventClasses(priority?: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 border-red-300 text-red-900 dark:bg-red-500/25 dark:border-red-500/40 dark:text-white dark:backdrop-blur-sm'
    case 'medium': return 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/25 dark:border-amber-500/40 dark:text-white dark:backdrop-blur-sm'
    case 'low': return 'bg-sky-100 border-sky-300 text-sky-900 dark:bg-sky-500/25 dark:border-sky-500/40 dark:text-white dark:backdrop-blur-sm'
    default: return 'bg-primary/15 border-primary/40 text-foreground dark:bg-primary/25 dark:text-white dark:backdrop-blur-sm'
  }
}

export const OVERDUE_EVENT_CLASSES = 'bg-red-500/85 border-red-600 text-white dark:bg-red-500/65 dark:border-red-500 dark:backdrop-blur-sm shadow-[0_0_0_1px_rgba(239,68,68,0.35)]'

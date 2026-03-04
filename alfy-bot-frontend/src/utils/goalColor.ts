const ACCENTS = ['#3b82f6', '#8b5cf6', '#f97316'] // blue, violet, orange

export function goalAccent(id: number): string {
  return ACCENTS[Math.abs((id - 1) % ACCENTS.length)] ?? ACCENTS[0]!
}

const BORDER_CLASSES = [
  'hover:border-blue-400 dark:hover:border-blue-500',
  'hover:border-violet-400 dark:hover:border-violet-500',
  'hover:border-orange-400 dark:hover:border-orange-500',
]

export function goalBorderClass(id: number): string {
  return BORDER_CLASSES[Math.abs((id - 1) % BORDER_CLASSES.length)] ?? BORDER_CLASSES[0]!
}

export const getTimeString = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export const updateDeadlineTime = (date: Date | undefined, timeString: string): Date | undefined => {
  if (!date || !timeString) return date

  const parts = timeString.split(':')
  const newDeadline = new Date(date)
  newDeadline.setHours(parseInt(parts[0] ?? '0'), parseInt(parts[1] ?? '0'))

  return newDeadline
}

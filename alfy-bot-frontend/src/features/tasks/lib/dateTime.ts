export const updateDeadlineTime = (date: Date | undefined, timeString: string): Date | undefined => {
  if (!date || !timeString) return date

  const parts = timeString.split(':')
  const newDeadline = new Date(date)
  newDeadline.setHours(parseInt(parts[0] ?? '0'), parseInt(parts[1] ?? '0'))

  return newDeadline
}

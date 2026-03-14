import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export const formatDate = (date: Date | string, formatStr: string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: ru })
}

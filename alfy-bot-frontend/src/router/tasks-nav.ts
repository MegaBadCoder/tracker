import { Inbox, CalendarDays } from 'lucide-vue-next'
import type { NavLink } from '@/types/navigation'

export const tasksNavLinks: NavLink[] = [
  { to: '/tasks', label: 'Входящие', icon: Inbox },
  { to: '/tasks/calendar', label: 'Календарь', icon: CalendarDays },
]

import type { NavLink } from '@/types/navigation'
import { CalendarCheck, CalendarDays, Inbox } from 'lucide-vue-next'

export const tasksNavLinks: NavLink[] = [
  { to: '/tasks', label: 'Входящие', icon: Inbox },
  { to: '/tasks/today', label: 'Сегодня', icon: CalendarCheck },
  { to: '/tasks/calendar', label: 'Календарь', icon: CalendarDays },
]

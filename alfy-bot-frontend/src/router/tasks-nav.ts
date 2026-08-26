import type { NavLink } from '@/types/navigation'
import { CalendarCheck, CalendarDays, Inbox } from 'lucide-vue-next'
import { countTodayTasks } from '@/features/tasks/lib/today'
import { useTaskStore } from '@/features/tasks/model/task-store'

export const tasksNavLinks: NavLink[] = [
  { to: '/tasks', label: 'Входящие', icon: Inbox },
  {
    to: '/tasks/today',
    label: 'Сегодня',
    icon: CalendarCheck,
    count: now => countTodayTasks(useTaskStore().tasks, now),
  },
  { to: '/tasks/calendar', label: 'Календарь', icon: CalendarDays },
]

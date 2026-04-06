import { Target, ListChecks, CheckSquare, Settings } from 'lucide-vue-next'
import type { NavLink } from '@/types/navigation'

export type { NavLink }

export const navLinks: NavLink[] = [
  { to: '/', label: 'Цели', icon: Target },
  { to: '/habits', label: 'Привычки', icon: ListChecks },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

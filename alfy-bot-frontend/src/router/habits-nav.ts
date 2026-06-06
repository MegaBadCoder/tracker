import { ListChecks, Atom } from 'lucide-vue-next'
import type { NavLink } from '@/types/navigation'

export const habitsNavLinks: NavLink[] = [
  { to: '/habits', label: 'Привычки по целям', icon: ListChecks },
  { to: '/habits/atomic', label: 'Атомные привычки', icon: Atom, badge: 'скоро' },
]

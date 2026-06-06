import type { NavLink } from '@/types/navigation'
import { Globe, ListChecks, Target } from 'lucide-vue-next'

export const goalsNavLinks: NavLink[] = [
  { to: '/', label: 'Все', icon: Target },
  { to: '/?scope=global', label: 'Глобальные', icon: Globe },
  { to: '/?scope=regular', label: 'Другие', icon: ListChecks },
]

import type { NavLink } from '@/types/navigation'
import { mount } from '@vue/test-utils'
import { Inbox } from 'lucide-vue-next'
import { describe, expect, it, vi } from 'vitest'
import SidebarNav from '@/components/SidebarNav.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/tasks', query: {} }),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
}))

vi.mock('@/features/tasks/lib/dnd/use-drop-target', () => ({
  useDropTarget: () => ({ isHovered: { value: false } }),
}))

function mountNav(links: NavLink[]) {
  return mount(SidebarNav, { props: { links } })
}

function link(overrides: Partial<NavLink> = {}): NavLink {
  return { to: '/tasks/today', label: 'Сегодня', icon: Inbox, ...overrides }
}

describe('sidebarNav — счётчик пункта', () => {
  it('рендерит число, когда count вернул больше нуля', () => {
    const wrapper = mountNav([link({ count: () => 4 })])

    expect(wrapper.text()).toContain('4')
  })

  it('не рендерит ноль — пустой пункт остаётся без бейджа', () => {
    const wrapper = mountNav([link({ count: () => 0 })])

    expect(wrapper.text()).not.toContain('0')
  })

  it('пункт без count рендерится как раньше', () => {
    const wrapper = mountNav([link({ label: 'Входящие', to: '/tasks' })])

    expect(wrapper.text()).toBe('Входящие')
  })

  it('передаёт в count текущее время — счётчик может пережить полночь', () => {
    const count = vi.fn().mockReturnValue(2)

    mountNav([link({ count })])

    expect(count).toHaveBeenCalled()
    expect(count.mock.calls[0]![0]).toBeInstanceOf(Date)
  })
})

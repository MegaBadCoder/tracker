import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'

const route = reactive<{ name: string }>({ name: 'tasks-project' })

vi.mock('vue-router', () => ({
  useRoute: () => route,
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}))

describe('projectTabs', () => {
  beforeEach(() => {
    route.name = 'tasks-project'
  })

  function links(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAllComponents({ name: 'RouterLink' })
  }

  it('рендерит три вкладки «Доска», «Бэклог» и «Релизы» со ссылками на маршруты проекта', () => {
    const wrapper = mount(ProjectTabs, { props: { projectId: 'proj-1' } })

    const items = links(wrapper)
    expect(items.map(l => l.text())).toEqual(['Доска', 'Бэклог', 'Релизы'])
    expect(items[0]!.props('to')).toEqual({ name: 'tasks-project', params: { projectId: 'proj-1' } })
    expect(items[1]!.props('to')).toEqual({ name: 'tasks-project-backlog', params: { projectId: 'proj-1' } })
    expect(items[2]!.props('to')).toEqual({ name: 'tasks-project-releases', params: { projectId: 'proj-1' } })
  })

  it('подсвечивает «Доска» на маршруте доски', () => {
    const wrapper = mount(ProjectTabs, { props: { projectId: 'proj-1' } })

    const [board, backlog] = links(wrapper)
    expect(board!.attributes('aria-current')).toBe('page')
    expect(backlog!.attributes('aria-current')).toBeUndefined()
  })

  it('подсвечивает «Бэклог» на маршруте бэклога', () => {
    route.name = 'tasks-project-backlog'
    const wrapper = mount(ProjectTabs, { props: { projectId: 'proj-1' } })

    const [board, backlog] = links(wrapper)
    expect(board!.attributes('aria-current')).toBeUndefined()
    expect(backlog!.attributes('aria-current')).toBe('page')
  })

  it('подсвечивает «Релизы» на маршруте релизов', () => {
    route.name = 'tasks-project-releases'
    const wrapper = mount(ProjectTabs, { props: { projectId: 'proj-1' } })

    const [board, backlog, releases] = links(wrapper)
    expect(board!.attributes('aria-current')).toBeUndefined()
    expect(backlog!.attributes('aria-current')).toBeUndefined()
    expect(releases!.attributes('aria-current')).toBe('page')
  })
})

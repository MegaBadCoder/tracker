import type { BoardGroupNode, Project, ProjectColumn, Release } from '@/features/projects/model/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useConfirm } from '@/composables/useConfirm'
import * as columnsApi from '@/features/projects/api/columns-api'
import * as groupsApi from '@/features/projects/api/groups-api'
import { releaseDeletionMessage } from '@/features/projects/lib/release'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import ReleaseActionDialog from '@/features/projects/ui/ReleaseActionDialog.vue'
import ReleaseFormDialog from '@/features/projects/ui/ReleaseFormDialog.vue'
import ReleaseRow from '@/features/projects/ui/ReleaseRow.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import ProjectReleasesView from '@/views/ProjectReleasesView.vue'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/features/projects/api/columns-api', () => ({
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}))

vi.mock('@/features/projects/api/groups-api', () => ({
  fetchGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
}))

const routerReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'proj-1' }, name: 'tasks-project-releases' }),
  useRouter: () => ({ replace: routerReplace }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list',
    type: 'agile',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'v1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned',
    releasedAt: null,
    order: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'e1',
    projectId: 'proj-1',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

function rawTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    releaseId: null,
    columnId: null,
    groupId: null,
    order: 0,
    ...overrides,
  }
}

const stubs = {
  TaskDetailDialog: true,
}

async function mountView(
  releases: Release[],
  tasks: Record<string, unknown>[] = [],
  project: Project = makeProject(),
  groups: BoardGroupNode[] = [],
) {
  vi.mocked(api.get).mockResolvedValue({ data: tasks })
  vi.mocked(columnsApi.fetchColumns).mockResolvedValue({ data: [] as ProjectColumn[] } as any)
  vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: groups } as any)
  useProjectStore().projects = [project]
  useReleaseStore().lists['proj-1'] = releases

  const wrapper = mount(ProjectReleasesView, { global: { stubs }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function rowIds(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAllComponents(ReleaseRow).map(r => r.attributes('data-release-id'))
}

describe('projectReleasesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('запланированные релизы идут по order, выпущенные скрыты и не рендерятся до раскрытия блока', async () => {
    const wrapper = await mountView([
      makeRelease({ id: 'later', name: 'Позже', order: 2 }),
      makeRelease({ id: 'shipped', name: 'Выпущенный', status: 'released', releasedAt: '2026-09-10T00:00:00.000Z', order: 5 }),
      makeRelease({ id: 'sooner', name: 'Раньше', order: 1 }),
    ])

    expect(wrapper.findAll('[data-testid="planned-releases"] [data-release-id]').map(r => r.attributes('data-release-id')))
      .toEqual(['sooner', 'later'])
    expect(rowIds(wrapper)).toEqual(['sooner', 'later'])
    expect(wrapper.text()).not.toContain('Выпущенный')
    wrapper.unmount()
  })

  it('заголовок «Выпущенные (N)» показывает число, клик раскрывает выпущенные релизы', async () => {
    const shipped = (id: string, releasedAt: string) =>
      makeRelease({ id, name: id, status: 'released', releasedAt, order: 0 })
    const wrapper = await mountView([
      shipped('old', '2026-08-01T00:00:00.000Z'),
      shipped('new', '2026-09-01T00:00:00.000Z'),
    ])

    const toggle = wrapper.get('[data-testid="released-releases"] button')
    expect(toggle.text()).toBe('Выпущенные (2)')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(rowIds(wrapper)).toEqual(['new', 'old'])
    wrapper.unmount()
  })

  it('без выпущенных релизов блока «Выпущенные» нет', async () => {
    const wrapper = await mountView([makeRelease()])

    expect(wrapper.find('[data-testid="released-releases"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('«+ Релиз» показывает поле ввода и создаёт релиз с введённым названием', async () => {
    const wrapper = await mountView([])
    const createSpy = vi.spyOn(useReleaseStore(), 'createRelease').mockResolvedValue(undefined as any)

    await wrapper.findAll('button').find(b => b.text() === 'Релиз')!.trigger('click')
    const input = wrapper.get('input')
    await input.setValue('  v2.0  ')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(createSpy).toHaveBeenCalledWith('proj-1', { name: 'v2.0' })
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })

  it('пустой ввод в «+ Релиз» отменяет создание', async () => {
    const wrapper = await mountView([])
    const createSpy = vi.spyOn(useReleaseStore(), 'createRelease').mockResolvedValue(undefined as any)

    await wrapper.findAll('button').find(b => b.text() === 'Релиз')!.trigger('click')
    await wrapper.get('input').trigger('keydown.enter')
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })

  it('не-agile проект перенаправляется на tasks-project', async () => {
    const wrapper = await mountView([], [], makeProject({ type: 'simple' }))

    expect(routerReplace).toHaveBeenCalledWith({ name: 'tasks-project', params: { projectId: 'proj-1' } })
    wrapper.unmount()
  })

  it('agile-проект не перенаправляется', async () => {
    const wrapper = await mountView([makeRelease()])

    expect(routerReplace).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('раскрытие строки показывает задачи только этого релиза, сгруппированные по эпику', async () => {
    const story = makeGroup({ id: 's1', type: 'story', parentId: 'e1', title: 'История' })
    const epic = makeGroup({ id: 'e1', title: 'Эпик', children: [story] })
    const wrapper = await mountView(
      [makeRelease({ id: 'a' }), makeRelease({ id: 'b', name: 'Другой', order: 1 })],
      [
        rawTask({ id: 'in-story', title: 'В истории', releaseId: 'a', groupId: 's1' }),
        rawTask({ id: 'loose', title: 'Без эпика', releaseId: 'a' }),
        rawTask({ id: 'foreign', title: 'В другом', releaseId: 'b' }),
      ],
      makeProject(),
      [epic],
    )

    const row = wrapper.get('[data-release-id="a"]')
    await row.get('button[aria-expanded]').trigger('click')

    const captions = row.findAll('[data-testid="release-bucket-caption"]').map(c => c.text())
    expect(captions).toEqual(['Эпик › История', 'Без эпика'])
    expect(row.text()).toContain('В истории')
    expect(row.text()).not.toContain('В другом')
    wrapper.unmount()
  })

  it('клик по задаче в раскрытой строке открывает TaskDetailDialog', async () => {
    const wrapper = await mountView(
      [makeRelease({ id: 'a' })],
      [rawTask({ id: 'x', title: 'Открыть меня', releaseId: 'a' })],
    )
    expect(wrapper.findComponent(TaskDetailDialog).props('open')).toBe(false)

    await wrapper.get('[data-release-id="a"] button[aria-expanded]').trigger('click')
    await wrapper.get('[data-task-id="x"]').trigger('click')

    const dialog = wrapper.findComponent(TaskDetailDialog)
    expect(dialog.props('open')).toBe(true)
    expect((dialog.props('task') as { id: string }).id).toBe('x')
    wrapper.unmount()
  })

  it('«Выпустить» открывает ReleaseActionDialog для выбранного релиза', async () => {
    const wrapper = await mountView([makeRelease({ id: 'a' })])
    expect(wrapper.findComponent(ReleaseActionDialog).exists()).toBe(false)

    wrapper.findComponent(ReleaseRow).vm.$emit('release')
    await flushPromises()

    const dialog = wrapper.findComponent(ReleaseActionDialog)
    expect(dialog.props('projectId')).toBe('proj-1')
    expect((dialog.props('release') as Release).id).toBe('a')
    wrapper.unmount()
  })

  it('«Изменить» открывает ReleaseFormDialog, закрытие снимает диалог', async () => {
    const wrapper = await mountView([makeRelease({ id: 'a' })])
    expect(wrapper.findComponent(ReleaseFormDialog).exists()).toBe(false)

    wrapper.findComponent(ReleaseRow).vm.$emit('edit')
    await flushPromises()

    const dialog = wrapper.findComponent(ReleaseFormDialog)
    expect((dialog.props('release') as Release).id).toBe('a')

    dialog.vm.$emit('update:open', false)
    await flushPromises()
    expect(wrapper.findComponent(ReleaseFormDialog).exists()).toBe(false)
    wrapper.unmount()
  })

  it('удаление показывает confirm с releaseDeletionMessage и после подтверждения вызывает deleteRelease', async () => {
    const release = makeRelease({ id: 'a', name: 'v1.0' })
    const wrapper = await mountView([release], [
      rawTask({ id: 'x', releaseId: 'a' }),
      rawTask({ id: 'y', releaseId: 'a', completed: true }),
      rawTask({ id: 'z', releaseId: null }),
    ])
    const deleteSpy = vi.spyOn(useReleaseStore(), 'deleteRelease').mockResolvedValue(undefined)
    const { options, handleConfirm } = useConfirm()

    wrapper.findComponent(ReleaseRow).vm.$emit('delete')
    await flushPromises()

    expect(options.value).toMatchObject({
      title: 'Удалить релиз?',
      message: releaseDeletionMessage(release, 2),
      variant: 'destructive',
    })
    expect(options.value?.message).toBe('Удалить релиз „v1.0“? 2 задачи останутся без релиза.')
    expect(deleteSpy).not.toHaveBeenCalled()

    handleConfirm()
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('proj-1', 'a')
    wrapper.unmount()
  })

  it('при отмене подтверждения deleteRelease не вызывается', async () => {
    const wrapper = await mountView([makeRelease()])
    const deleteSpy = vi.spyOn(useReleaseStore(), 'deleteRelease').mockResolvedValue(undefined)
    const { handleCancel } = useConfirm()

    wrapper.findComponent(ReleaseRow).vm.$emit('delete')
    await flushPromises()
    handleCancel()
    await flushPromises()

    expect(deleteSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { api } from '@/api/client'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskView from '@/views/TaskView.vue'

const mocks = vi.hoisted(() => ({ push: vi.fn(), confirm: vi.fn() }))
const route = reactive({ params: { taskId: 'one' } })
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/api/client', () => ({ api: { get: vi.fn(), delete: vi.fn(), patch: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }))
vi.mock('@/features/tasks/ui/TaskDetailDialog.vue', () => ({ default: { name: 'TaskDetailDialog', props: ['task', 'open'], emits: ['update:open', 'delete', 'update'], template: '<div v-if="open" data-testid="detail">{{ task.title }}</div>' } }))
const stubs = { AppHeader: true, PageContainer: { template: '<main><slot /></main>' }, Button: { template: '<button><slot /></button>' } }
function render() {
  return mount(TaskView, { global: { stubs, provide: { openSidebar: vi.fn() } } })
}
function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('taskView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    route.params.taskId = 'one'
    mocks.confirm.mockResolvedValue(true)
  })
  it('loads directly from the URL and uses existing update handlers', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 'one', title: 'Task', projectId: 'project' } })
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 'one', title: 'Edited' } })
    const wrapper = render()
    expect(wrapper.text()).toContain('Загрузка задачи')
    await flushPromises()
    expect(wrapper.get('[data-testid="detail"]').text()).toBe('Task')
    wrapper.findComponent({ name: 'TaskDetailDialog' }).vm.$emit('update', { ...useTaskStore().tasks[0], title: 'Edited' })
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/tasks/one', expect.objectContaining({ title: 'Edited' }))
    wrapper.findComponent({ name: 'TaskDetailDialog' }).vm.$emit('update:open', false)
    expect(mocks.push).toHaveBeenCalledWith({ name: 'tasks-project', params: { projectId: 'project' } })
    wrapper.unmount()
  })
  it('separates missing from network failure and retries', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('Задача не найдена')
    expect(wrapper.text()).not.toContain('Повторить')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
    route.params.taskId = 'two'
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось загрузить задачу')
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'two', title: 'Recovered' } })
    await wrapper.findAll('button').find(b => b.text() === 'Повторить')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Recovered')
    wrapper.unmount()
  })
  it('ignores responses from a previous URL', async () => {
    const first = deferred()
    vi.mocked(api.get).mockReturnValueOnce(first.promise as never)
    const wrapper = render()
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'two', title: 'Second' } })
    route.params.taskId = 'two'
    await flushPromises()
    first.resolve({ data: { id: 'one', title: 'First' } })
    await flushPromises()
    expect(wrapper.get('[data-testid="detail"]').text()).toBe('Second')
    wrapper.unmount()
  })
  it('restores the task after cancelled deletion; confirmed deletion returns to inbox', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 'one', title: 'Task' } })
    const wrapper = render()
    await flushPromises()
    mocks.confirm.mockResolvedValueOnce(false)
    wrapper.findComponent({ name: 'TaskDetailDialog' }).vm.$emit('delete', 'one')
    await flushPromises()
    expect(wrapper.get('[data-testid="detail"]').text()).toBe('Task')
    expect(mocks.push).not.toHaveBeenCalled()
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} })
    wrapper.findComponent({ name: 'TaskDetailDialog' }).vm.$emit('delete', 'one')
    await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('/tasks/one')
    expect(mocks.push).toHaveBeenCalledWith({ name: 'tasks' })
    wrapper.unmount()
  })
  it('does not open a task after unmount', async () => {
    const pending = deferred()
    vi.mocked(api.get).mockReturnValueOnce(pending.promise as never)
    const wrapper = render()
    wrapper.unmount()
    pending.resolve({ data: { id: 'one', title: 'Late' } })
    await nextTick()
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it('keeps the new task visible when a previous task update fails', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'one', title: 'First' } })
    let reject!: (reason: Error) => void
    vi.mocked(api.patch).mockReturnValueOnce(new Promise((_, fail) => {
      reject = fail
    }))
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskDetailDialog' }).vm.$emit('update', { ...useTaskStore().tasks[0], title: 'Edited' })
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'two', title: 'Second' } })
    route.params.taskId = 'two'
    await flushPromises()
    reject(new Error('Failed'))
    await flushPromises()
    expect(wrapper.get('[data-testid="detail"]').text()).toBe('Second')
    wrapper.unmount()
  })
})

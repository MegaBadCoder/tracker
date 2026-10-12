import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProjectColumnSettings from '@/features/projects/ui/ProjectColumnSettings.vue'
import { useColumnStore } from '@/features/projects/model/column-store'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
const columns = [
  { id: 'a', projectId: 'p', title: 'План', order: 0, color: null },
  { id: 'b', projectId: 'p', title: 'Работа', order: 1, color: null },
]
async function setup() {
  const wrapper = mount(ProjectColumnSettings, { props: { projectId: 'p' } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: structuredClone(columns) })
})

describe('настройки колонок проекта', () => {
  it('добавляет колонку в конец и обновляет открытую доску', async () => {
    const store = useColumnStore()
    store.currentProjectId = 'p'
    const wrapper = await setup()
    const created = { id: 'c', projectId: 'p', title: 'Проверка', order: 2, color: null }
    vi.mocked(api.post).mockResolvedValue({ data: created })
    await wrapper.get('[aria-label="Название новой колонки"]').setValue(' Проверка ')
    await wrapper.findAll('form').at(-1)!.trigger('submit')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/projects/p/columns', { title: 'Проверка' })
    expect(store.columns.map(c => c.id)).toEqual(['a', 'b', 'c'])
    expect(wrapper.findAll('[data-column-id]')).toHaveLength(3)
  })

  it('сохраняет введённое название при ошибке и допускает повтор', async () => {
    const wrapper = await setup()
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('Нет связи')).mockResolvedValueOnce({ data: { ...columns[0], title: 'Новый' } })
    await wrapper.get('[aria-label="Название колонки План"]').setValue('Новый')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Нет связи')
    expect((wrapper.get('[aria-label="Название колонки План"]').element as HTMLInputElement).value).toBe('Новый')
    await wrapper.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(wrapper.find('[aria-label="Название колонки Новый"]').exists()).toBe(true)
  })

  it('сохраняет полный порядок и не трогает открытую доску другого проекта', async () => {
    const store = useColumnStore()
    store.currentProjectId = 'other'
    store.columns = [{ ...columns[0]!, projectId: 'other' }]
    const wrapper = await setup()
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    await wrapper.get('[aria-label="Переместить Работа выше"]').trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/projects/p/columns/reorder', { orderedIds: ['b', 'a'] })
    expect(wrapper.findAll('[data-column-id]').map(row => row.attributes('data-column-id'))).toEqual(['b', 'a'])
    expect(store.columns[0]?.projectId).toBe('other')
  })

  it('сохраняет занятую колонку при 409 и показывает объяснение', async () => {
    const wrapper = await setup()
    vi.mocked(api.delete).mockRejectedValue({ response: { data: { message: 'Сначала перенесите задачи в другую колонку' } } })
    await wrapper.get('[aria-label="Удалить колонку План"]').trigger('click')
    expect(api.delete).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(button => button.text() === 'Удалить')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Сначала перенесите задачи')
    expect(wrapper.findAll('[data-column-id]')).toHaveLength(2)
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    await wrapper.findAll('button').find(button => button.text() === 'Удалить')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-column-id]')).toHaveLength(1)
  })

  it('не отправляет пустое название и повторный запрос во время сохранения', async () => {
    const wrapper = await setup()
    const form = wrapper.findAll('form').at(-1)!
    await form.trigger('submit')
    expect(api.post).not.toHaveBeenCalled()
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}))
    await wrapper.get('[aria-label="Название новой колонки"]').setValue('Проверка')
    await form.trigger('submit')
    await form.trigger('submit')
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('игнорирует запоздалую загрузку предыдущего проекта', async () => {
    let resolve!: (value: any) => void
    vi.mocked(api.get).mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValueOnce({ data: [] })
    const wrapper = mount(ProjectColumnSettings, { props: { projectId: 'p' } })
    await wrapper.setProps({ projectId: 'other' })
    await flushPromises()
    resolve({ data: columns })
    await flushPromises()
    expect(wrapper.findAll('[data-column-id]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Добавьте первую')
  })
})

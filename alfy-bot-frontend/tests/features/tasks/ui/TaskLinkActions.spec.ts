import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskLinkActions from '@/features/tasks/ui/TaskLinkActions.vue'

const taskId = 'e797ece0-197b-452a-8cc1-123456789012'

function clipboard(writeText?: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('navigator', { clipboard: writeText ? { writeText } : undefined })
}

afterEach(() => vi.unstubAllGlobals())

describe('taskLinkActions', () => {
  it('открывает канонический URL в отдельной вкладке', () => {
    const wrapper = mount(TaskLinkActions, { props: { taskId } })
    expect(wrapper.get('a').attributes()).toMatchObject({ 'href': `${window.location.origin}/tasks/${taskId}`, 'target': '_blank', 'rel': 'noopener noreferrer', 'aria-label': 'Открыть задачу в новой вкладке' })
  })

  it('сообщает успех только после записи полной ссылки', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    clipboard(writeText)
    const wrapper = mount(TaskLinkActions, { props: { taskId } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/tasks/${taskId}`)
    expect(wrapper.get('[role="status"]').text()).toBe('Ссылка скопирована')
  })

  it.each(['rejected', 'unsupported'])('показывает ошибку копирования: %s', async (mode) => {
    clipboard(mode === 'rejected' ? vi.fn().mockRejectedValue(new Error('Denied')) : undefined)
    const wrapper = mount(TaskLinkActions, { props: { taskId } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось скопировать ссылку')
    expect(wrapper.text()).not.toContain('Ссылка скопирована')
  })

  it.each(['temp-123', `${taskId}:2026-10-18`])('скрывает действия для %s', (id) => {
    const wrapper = mount(TaskLinkActions, { props: { taskId: id } })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

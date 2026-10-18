import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskDescription from '@/features/tasks/ui/TaskDescription.vue'

function mountDescription(description = '[Схема](https://example.com)', editable = true) {
  return mount(TaskDescription, { props: { description, editable }, attachTo: document.body })
}

function button(wrapper: ReturnType<typeof mountDescription>, text: string) {
  return wrapper.findAll('button').find(item => item.text() === text)!
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('taskDescription', () => {
  it('читает Markdown без включения редактора по нажатию на текст', async () => {
    const wrapper = mountDescription()
    expect(wrapper.get('a').text()).toBe('Схема')
    await wrapper.get('a').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
  })

  it('сохраняет точный исходник только кнопкой', async () => {
    const wrapper = mountDescription()
    await button(wrapper, 'Редактировать').trigger('click')
    const input = wrapper.get('textarea')
    expect(input.element.value).toBe('[Схема](https://example.com)')
    const raw = '  **Текст**\n\n[Клиент](https://example.com/client)  '
    await input.setValue(raw)
    await input.trigger('blur')
    expect(wrapper.emitted('save')).toBeUndefined()
    await button(wrapper, 'Сохранить').trigger('click')
    expect(wrapper.emitted('save')).toEqual([[raw]])
    wrapper.unmount()
  })

  it.each(['Отмена', 'Escape'])('отменяет через %s без сохранения', async (action) => {
    const wrapper = mountDescription()
    await button(wrapper, 'Редактировать').trigger('click')
    await wrapper.get('textarea').setValue('Черновик')
    if (action === 'Escape')
      await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    else await button(wrapper, action).trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()
    await button(wrapper, 'Редактировать').trigger('click')
    expect(wrapper.get('textarea').element.value).toBe('[Схема](https://example.com)')
    wrapper.unmount()
  })

  it('позволяет очистить описание, не отправляет неизменённое', async () => {
    const wrapper = mountDescription()
    await button(wrapper, 'Редактировать').trigger('click')
    await button(wrapper, 'Сохранить').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    await button(wrapper, 'Редактировать').trigger('click')
    await wrapper.get('textarea').setValue('')
    await button(wrapper, 'Сохранить').trigger('click')
    expect(wrapper.emitted('save')).toEqual([['']])
    wrapper.unmount()
  })

  it('не позволяет редактировать readonly и сбрасывает открытый черновик при потере прав', async () => {
    const wrapper = mountDescription('', false)
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ editable: true })
    await button(wrapper, 'Добавить описание').trigger('click')
    await wrapper.get('textarea').setValue('Черновик')
    await wrapper.setProps({ editable: false })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
  })

  it('раскрывает длинное описание отдельно от редактирования', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500)
    const wrapper = mountDescription('Длинное описание')
    await wrapper.vm.$nextTick()
    await button(wrapper, 'Подробнее').trigger('click')
    expect(button(wrapper, 'Свернуть')).toBeDefined()
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })
})

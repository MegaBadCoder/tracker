import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import InlineTitleInput from '@/features/projects/ui/InlineTitleInput.vue'

describe('inlineTitleInput', () => {
  it('по Enter отдаёт обрезанное непустое значение', async () => {
    const wrapper = mount(InlineTitleInput, { props: { placeholder: 'Название' } })
    await wrapper.find('input').setValue('  Новый эпик  ')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('submit')).toEqual([['Новый эпик']])
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('пустое значение по Enter отменяет ввод', async () => {
    const wrapper = mount(InlineTitleInput, { props: { placeholder: 'Название' } })
    await wrapper.find('input').setValue('   ')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('esc отменяет ввод', async () => {
    const wrapper = mount(InlineTitleInput, { props: { placeholder: 'Название' } })
    await wrapper.find('input').setValue('Что-то')
    await wrapper.find('input').trigger('keydown.escape')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('потеря фокуса отменяет ввод', async () => {
    const wrapper = mount(InlineTitleInput, { props: { placeholder: 'Название' } })
    await wrapper.find('input').setValue('Что-то')
    await wrapper.find('input').trigger('blur')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('автофокус устанавливается при монтировании', async () => {
    const wrapper = mount(InlineTitleInput, {
      props: { placeholder: 'Название' },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()

    expect(wrapper.find('input').element).toBe(document.activeElement)
    wrapper.unmount()
  })

  it('initial предзаполняет поле для переименования', () => {
    const wrapper = mount(InlineTitleInput, { props: { placeholder: 'Название', initial: 'Старое название' } })

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Старое название')
  })
})

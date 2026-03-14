import { describe, it, expect } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import type { Task } from '@/features/tasks/model/types'

describe('TaskForm', () => {
  it('рендерит поле названия и кнопку добавления', () => {
    const wrapper = mount(TaskForm)

    expect(wrapper.find('input[placeholder="Название задачи"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Добавить задачу')
  })

  it('кнопка добавления заблокирована при пустом названии', () => {
    const wrapper = mount(TaskForm)
    const submitBtn = wrapper.findAll('button').find((b: VueWrapper) => b.text().includes('Добавить задачу'))

    expect(submitBtn?.element.hasAttribute('disabled')).toBe(true)
  })

  it('кнопка добавления заблокирована при loading', () => {
    const wrapper = mount(TaskForm, { props: { loading: true } })
    const submitBtn = wrapper.findAll('button').find((b: VueWrapper) =>
      b.text().includes('Добавить') || b.text().includes('Добавление'),
    )

    expect(submitBtn?.element.hasAttribute('disabled')).toBe(true)
  })

  it('эмитит submit с корректным payload при клике Добавить', async () => {
    const wrapper = mount(TaskForm)
    const input = wrapper.find('input[placeholder="Название задачи"]')

    await input.setValue('Новая задача')
    await wrapper.vm.$nextTick()

    const submitBtn = wrapper.findAll('button').find((b: VueWrapper) => b.text().includes('Добавить задачу'))
    await submitBtn?.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toHaveLength(1)

    const payload = emitted![0][0] as Omit<Task, 'id' | 'completed' | 'pomodoroCompleted'>
    expect(payload.title).toBe('Новая задача')
    expect(payload.description).toBe('')
    expect(payload.isPomodoroTask).toBe(false)
    expect(payload.pomodoroCount).toBe(4)
    expect(payload.pomodoroDuration).toBe(25)
  })

  it('эмитит submit с pomodoro-полями по умолчанию', async () => {
    const wrapper = mount(TaskForm)
    const input = wrapper.find('input[placeholder="Название задачи"]')
    await input.setValue('Task with defaults')
    await wrapper.vm.$nextTick()

    const submitBtn = wrapper.findAll('button').find((b: VueWrapper) => b.text().includes('Добавить задачу'))
    await submitBtn?.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toHaveLength(1)
    const payload = emitted![0][0] as Omit<Task, 'id' | 'completed' | 'pomodoroCompleted'>

    expect(payload.isPomodoroTask).toBe(false)
    expect(payload.pomodoroCount).toBe(4)
    expect(payload.pomodoroDuration).toBe(25)
    expect(payload.shortBreak).toBe(5)
    expect(payload.longBreak).toBe(15)
    expect(payload.longBreakInterval).toBe(4)
  })

  it('не эмитит submit при пустом названии', async () => {
    const wrapper = mount(TaskForm)
    const submitBtn = wrapper.findAll('button').find((b: VueWrapper) => b.text().includes('Добавить задачу'))

    if (submitBtn && !submitBtn.attributes('disabled')) {
      await submitBtn.trigger('click')
    }

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('resetForm очищает форму', async () => {
    const wrapper = mount(TaskForm)
    const input = wrapper.find('input[placeholder="Название задачи"]')
    await input.setValue('Задача для сброса')
    await wrapper.vm.$nextTick()

    ;(wrapper.vm as { resetForm: () => void }).resetForm()
    await wrapper.vm.$nextTick()

    const inputAfter = wrapper.find('input[placeholder="Название задачи"]')
    expect((inputAfter.element as HTMLInputElement).value).toBe('')
  })

  it('Enter в поле названия вызывает submit', async () => {
    const wrapper = mount(TaskForm)
    const input = wrapper.find('input[placeholder="Название задачи"]')
    await input.setValue('Задача по Enter')
    await input.trigger('keyup.enter')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as { title: string }).title).toBe('Задача по Enter')
  })
})

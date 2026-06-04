import { describe, it, expect } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import type { Task } from '@/features/tasks/model/types'

// TaskForm uses <ContentEditableInput> (div+contenteditable) instead of native
// <input> for title/description. The contenteditable element emits 'input' on
// textContent change.
async function setTitle(wrapper: VueWrapper, value: string): Promise<void> {
  const el = wrapper.find('[aria-label="Название задачи"]')
  ;(el.element as HTMLElement).textContent = value
  await el.trigger('input')
  await wrapper.vm.$nextTick()
}

function submitBtn(wrapper: VueWrapper) {
  return wrapper
    .findAll('button')
    .find((b: VueWrapper) => b.text().includes('Добавить задачу') || b.text().includes('Добавление'))
}

describe('TaskForm', () => {
  it('рендерит поле названия и кнопку добавления', () => {
    const wrapper = mount(TaskForm)

    expect(wrapper.find('[aria-label="Название задачи"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Добавить задачу')
  })

  it('кнопка добавления заблокирована при пустом названии', () => {
    const wrapper = mount(TaskForm)

    expect(submitBtn(wrapper)?.element.hasAttribute('disabled')).toBe(true)
  })

  it('кнопка добавления заблокирована при loading', () => {
    const wrapper = mount(TaskForm, { props: { loading: true } })

    expect(submitBtn(wrapper)?.element.hasAttribute('disabled')).toBe(true)
  })

  it('эмитит submit с корректным payload при клике Добавить', async () => {
    const wrapper = mount(TaskForm)
    await setTitle(wrapper, 'Новая задача')

    await submitBtn(wrapper)?.trigger('click')

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
    await setTitle(wrapper, 'Task with defaults')

    await submitBtn(wrapper)?.trigger('click')

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
    const btn = submitBtn(wrapper)

    if (btn && !btn.attributes('disabled')) {
      await btn.trigger('click')
    }

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('resetForm очищает форму', async () => {
    const wrapper = mount(TaskForm)
    await setTitle(wrapper, 'Задача для сброса')

    ;(wrapper.vm as { resetForm: () => void }).resetForm()
    // ContentEditableInput sync via watch → nested nextTick — need two flushes.
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const el = wrapper.find('[aria-label="Название задачи"]').element as HTMLElement
    expect(el.textContent || '').toBe('')
  })

  it('Enter в поле названия вызывает submit', async () => {
    const wrapper = mount(TaskForm)
    await setTitle(wrapper, 'Задача по Enter')

    await wrapper.find('[aria-label="Название задачи"]').trigger('keydown', { key: 'Enter' })

    const emitted = wrapper.emitted('submit')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as { title: string }).title).toBe('Задача по Enter')
  })
})

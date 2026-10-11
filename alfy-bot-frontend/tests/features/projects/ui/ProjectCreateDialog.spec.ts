import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ProjectCreateDialog from '@/features/projects/ui/ProjectCreateDialog.vue'

const createProject = vi.fn()

vi.mock('@/features/projects/model/project-store', () => ({
  useProjectStore: () => ({ createProject }),
}))

const stubs = {
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  Input: {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Button: { template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>' },
  IconPicker: true,
  ColorPicker: true,
  ProjectPicker: true,
}

function findTabButton(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find(button => button.text() === text)
}

async function selectAgileTab(wrapper: ReturnType<typeof mount>) {
  await findTabButton(wrapper, 'Agile')?.trigger('mousedown', { button: 0 })
}

describe('ProjectCreateDialog', () => {
  beforeEach(() => {
    createProject.mockReset()
    createProject.mockResolvedValue({ id: 'new-project' })
  })

  it('создаёт проект с типом simple по умолчанию', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Мой проект')
    const submitButton = wrapper.findAll('button').find(button => button.text() === 'Создать')
    await submitButton?.trigger('click')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'simple' }),
    )
  })

  it('отправляет выбор Agile как type в payload', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Мой agile-проект')
    await selectAgileTab(wrapper)
    await nextTick()

    const submitButton = wrapper.findAll('button').find(button => button.text() === 'Создать')
    await submitButton?.trigger('click')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'agile' }),
    )
  })

  it('сбрасывает тип на simple при повторном открытии', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    await selectAgileTab(wrapper)
    await nextTick()

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Ещё проект')
    const submitButton = wrapper.findAll('button').find(button => button.text() === 'Создать')
    await submitButton?.trigger('click')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'simple' }),
    )
  })

  it('поле префикса появляется только при выборе Agile', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    expect(wrapper.find('[data-testid="task-key-prefix-input"]').exists()).toBe(false)

    await selectAgileTab(wrapper)
    await nextTick()

    expect(wrapper.find('[data-testid="task-key-prefix-input"]').exists()).toBe(true)
  })

  it('отправляет префикс в верхнем регистре для agile', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Alfy')
    await selectAgileTab(wrapper)
    await nextTick()
    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('alf')
    await wrapper.findAll('button').find(button => button.text() === 'Создать')?.trigger('click')
    await flushPromises()

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'agile', taskKeyPrefix: 'ALF' }),
    )
  })

  it('без введённого префикса taskKeyPrefix в payload не передаётся', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Alfy')
    await selectAgileTab(wrapper)
    await nextTick()
    await wrapper.findAll('button').find(button => button.text() === 'Создать')?.trigger('click')
    await flushPromises()

    expect(createProject.mock.calls[0]?.[0]).not.toHaveProperty('taskKeyPrefix')
  })

  it('заведомо неверный префикс блокирует создание', async () => {
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Alfy')
    await selectAgileTab(wrapper)
    await nextTick()
    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('ТЕСТ')
    const submit = wrapper.findAll('button').find(button => button.text() === 'Создать')
    await submit?.trigger('click')
    await flushPromises()

    expect(submit?.attributes('disabled')).toBeDefined()
    expect(createProject).not.toHaveBeenCalled()
  })

  it('показывает ошибку сервера и не закрывает диалог', async () => {
    createProject.mockRejectedValue({ response: { data: { message: 'Task key prefix is already used' } } })
    const wrapper = mount(ProjectCreateDialog, {
      props: { open: false },
      global: { stubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('input[placeholder="Название проекта"]').setValue('Alfy')
    await selectAgileTab(wrapper)
    await nextTick()
    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('ALF')
    await wrapper.findAll('button').find(button => button.text() === 'Создать')?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="project-create-error"]').text()).toBe('Task key prefix is already used')
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})

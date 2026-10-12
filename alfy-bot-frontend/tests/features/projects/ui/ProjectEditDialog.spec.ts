import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ProjectEditDialog from '@/features/projects/ui/ProjectEditDialog.vue'
import type { Project } from '@/features/projects/model/types'

const updateProject = vi.fn()
const mockStore = {
  projects: [] as Project[],
  updateProject,
}

vi.mock('@/features/projects/model/project-store', () => ({
  useProjectStore: () => mockStore,
}))

const ProjectPickerStub = defineComponent({
  props: {
    context: { type: String, default: 'task' },
  },
  emits: ['update:modelValue'],
  template: `
    <div>
      <span class="null-option-label">{{ context === 'parent' ? 'Не назначено' : 'Все входящие' }}</span>
      <button class="set-null" @click="$emit('update:modelValue', null)">set-null</button>
    </div>
  `,
})

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: 'parent-1',
    title: 'Проект',
    description: null,
    viewMode: 'list',
    type: 'simple',
    icon: null,
    color: null,
    order: 0,
    taskKeyPrefix: null,
    ...overrides,
  }
}

describe('ProjectEditDialog', () => {
  beforeEach(() => {
    mockStore.projects = [makeProject(), makeProject({ id: 'parent-1', parentId: null, title: 'Родитель' })]
    updateProject.mockReset()
    updateProject.mockResolvedValue(undefined)
  })

  it('показывает пункт "Не назначено" для выбора parent проекта', async () => {
    const wrapper = mount(ProjectEditDialog, {
      props: {
        open: false,
        project: makeProject(),
      },
      global: {
        stubs: {
          Dialog: { name: 'Dialog', emits: ['update:open'], template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<h2><slot /></h2>' },
          DialogDescription: { template: '<p><slot /></p>' },
          ProjectColumnSettings: true,
          Input: {
            props: ['modelValue', 'placeholder'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          IconPicker: true,
          ColorPicker: true,
          ProjectPicker: ProjectPickerStub,
        },
      },
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    expect(wrapper.text()).toContain('Не назначено')
  })

  it('сохраняет parentId = null при выборе "Не назначено"', async () => {
    const wrapper = mount(ProjectEditDialog, {
      props: {
        open: false,
        project: makeProject(),
      },
      global: {
        stubs: {
          Dialog: { name: 'Dialog', emits: ['update:open'], template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<h2><slot /></h2>' },
          DialogDescription: { template: '<p><slot /></p>' },
          ProjectColumnSettings: true,
          Input: {
            props: ['modelValue', 'placeholder'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          IconPicker: true,
          ColorPicker: true,
          ProjectPicker: ProjectPickerStub,
        },
      },
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('button.set-null').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        parentId: null,
      }),
    )
  })

  const editStubs = {
    Dialog: { name: 'Dialog', emits: ['update:open'], template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<h2><slot /></h2>' },
          DialogDescription: { template: '<p><slot /></p>' },
          ProjectColumnSettings: true,
    Input: {
      props: ['modelValue', 'placeholder'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    Button: { emits: ['click'], template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>' },
    IconPicker: true,
    ColorPicker: true,
    ProjectPicker: ProjectPickerStub,
  }

  async function openDialog(project: Project) {
    const wrapper = mount(ProjectEditDialog, {
      props: { open: false, project },
      global: { stubs: editStubs },
    })
    await wrapper.setProps({ open: true })
    await nextTick()
    return wrapper
  }

  function saveButton(wrapper: Awaited<ReturnType<typeof openDialog>>) {
    return wrapper.findAll('button').find(button => button.text() === 'Сохранить')
  }

  it('поле префикса есть только у agile-проекта', async () => {
    const agile = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: 'ALF' }))
    expect(agile.find('[data-testid="task-key-prefix-input"]').exists()).toBe(true)
    expect(agile.text()).toContain('2–10 латинских букв и цифр, начинается с буквы')

    const simple = await openDialog(makeProject({ type: 'simple' }))
    expect(simple.find('[data-testid="task-key-prefix-input"]').exists()).toBe(false)
  })

  it('подставляет текущий префикс и приводит ввод к верхнему регистру', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: 'ALF' }))
    const input = wrapper.get('[data-testid="task-key-prefix-input"]')
    expect((input.element as HTMLInputElement).value).toBe('ALF')

    await input.setValue('bot')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ taskKeyPrefix: 'BOT' }),
    )
  })

  it('пустой префикс уходит как null', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: 'ALF' }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ taskKeyPrefix: null }),
    )
  })

  it('у обычного проекта taskKeyPrefix в payload не передаётся', async () => {
    const wrapper = await openDialog(makeProject({ type: 'simple' }))
    await wrapper.get('[placeholder="Название проекта"]').setValue('Обновлённый')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateProject.mock.calls[0]?.[1]).not.toHaveProperty('taskKeyPrefix')
  })

  it('заведомо неверный префикс блокирует сохранение', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: null }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('АЛФ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(saveButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('показывает ошибку сервера и не закрывает диалог', async () => {
    updateProject.mockRejectedValue({ response: { data: { message: 'Task key prefix is already used' } } })
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: null }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('ALF')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="project-edit-error"]').text()).toBe('Task key prefix is already used')
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
  it('показывает данные при первом открытом монтировании и блокирует неизменённое сохранение', async () => {
    const wrapper = mount(ProjectEditDialog, { props: { open: true, project: makeProject() }, global: { stubs: editStubs } })
    expect((wrapper.get('[placeholder="Название проекта"]').element as HTMLInputElement).value).toBe('Проект')
    expect(saveButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('предлагает вернуться к несохранённым данным перед закрытием', async () => {
    const wrapper = await openDialog(makeProject())
    await wrapper.get('[placeholder="Название проекта"]').setValue('Черновик')
    await wrapper.findAll('button').find(button => button.text() === 'Отмена')!.trigger('click')
    expect(wrapper.text()).toContain('не сохранены')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    await wrapper.findAll('button').find(button => button.text() === 'Вернуться')!.trigger('click')
    expect((wrapper.get('[placeholder="Название проекта"]').element as HTMLInputElement).value).toBe('Черновик')
    await wrapper.findAll('button').find(button => button.text() === 'Отмена')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Не сохранять')!.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('смена проекта сбрасывает предыдущий черновик', async () => {
    const wrapper = await openDialog(makeProject())
    await wrapper.get('[placeholder="Название проекта"]').setValue('Черновик')
    await wrapper.setProps({ project: makeProject({ id: 'other', title: 'Другой' }) })
    expect((wrapper.get('[placeholder="Название проекта"]').element as HTMLInputElement).value).toBe('Другой')
    expect(saveButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('не закрывает окно пока сохраняются колонки', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile' }))
    wrapper.findComponent({ name: 'ProjectColumnSettings' }).vm.$emit('busyChange', true)
    await nextTick()
    wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('сохранение основного раздела не теряет черновик колонки', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile' }))
    await wrapper.get('[placeholder="Название проекта"]').setValue('Обновлённый')
    wrapper.findComponent({ name: 'ProjectColumnSettings' }).vm.$emit('dirtyChange', true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(updateProject).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(wrapper.get('[role="tab"][data-state="active"]').text()).toBe('Колонки')
    await wrapper.findAll('button').find(button => button.text() === 'Готово')!.trigger('click')
    expect(wrapper.text()).toContain('Изменения не сохранены')
  })

})

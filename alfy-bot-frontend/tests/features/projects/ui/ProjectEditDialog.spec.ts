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
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          Input: {
            props: ['modelValue', 'placeholder'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
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
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          Input: {
            props: ['modelValue', 'placeholder'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          IconPicker: true,
          ColorPicker: true,
          ProjectPicker: ProjectPickerStub,
        },
      },
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    await wrapper.find('button.set-null').trigger('click')
    const saveButton = wrapper.findAll('button').find(button => button.text() === 'Сохранить')
    await saveButton?.trigger('click')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        parentId: null,
      }),
    )
  })

  const editStubs = {
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
    await saveButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ taskKeyPrefix: 'BOT' }),
    )
  })

  it('пустой префикс уходит как null', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: 'ALF' }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('  ')
    await saveButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ taskKeyPrefix: null }),
    )
  })

  it('у обычного проекта taskKeyPrefix в payload не передаётся', async () => {
    const wrapper = await openDialog(makeProject({ type: 'simple' }))

    await saveButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(updateProject.mock.calls[0]?.[1]).not.toHaveProperty('taskKeyPrefix')
  })

  it('заведомо неверный префикс блокирует сохранение', async () => {
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: null }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('АЛФ')
    await saveButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(saveButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('показывает ошибку сервера и не закрывает диалог', async () => {
    updateProject.mockRejectedValue({ response: { data: { message: 'Task key prefix is already used' } } })
    const wrapper = await openDialog(makeProject({ type: 'agile', taskKeyPrefix: null }))

    await wrapper.get('[data-testid="task-key-prefix-input"]').setValue('ALF')
    await saveButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="project-edit-error"]').text()).toBe('Task key prefix is already used')
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})

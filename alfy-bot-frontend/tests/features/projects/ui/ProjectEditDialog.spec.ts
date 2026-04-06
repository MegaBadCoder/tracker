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
    icon: null,
    color: null,
    order: 0,
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
})

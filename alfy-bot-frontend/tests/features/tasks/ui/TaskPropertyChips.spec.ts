import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskPropertyChips from '@/features/tasks/ui/TaskPropertyChips.vue'

function baseProps() {
  return {
    projectTitle: null,
    dueDate: undefined,
    deadline: undefined,
    priority: undefined,
    location: '',
    tags: [],
    recurrence: null,
    goalsLabel: 'Цель',
    goalsSet: false,
    editable: true,
  }
}

describe('taskPropertyChips — чип эпика/истории', () => {
  it('не рендерит чип «Эпик / История», когда groupTitle не передан', () => {
    const wrapper = mount(TaskPropertyChips, { props: baseProps() })
    expect(wrapper.text()).not.toContain('Без эпика')
  })

  it('рендерит чип со значением groupTitle, когда проп передан', () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), groupTitle: 'Эпик › История' },
    })
    expect(wrapper.text()).toContain('Эпик › История')
  })

  it('рендерит «Без эпика», когда groupTitle передан как null', () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), groupTitle: null },
    })
    expect(wrapper.text()).toContain('Без эпика')
  })

  it('эмитит select с ключом group при клике на чип', async () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), groupTitle: 'Эпик' },
    })
    const button = wrapper.findAll('button').find(b => b.text().includes('Эпик'))
    await button!.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['group'])
  })
})

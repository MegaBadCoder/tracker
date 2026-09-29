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

describe('taskPropertyChips — чип спринта', () => {
  it('не рендерит чип спринта, когда sprintTitle не передан', () => {
    const wrapper = mount(TaskPropertyChips, { props: baseProps() })
    expect(wrapper.text()).not.toContain('Бэклог')
  })

  it('рендерит чип со значением sprintTitle, когда проп передан', () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), sprintTitle: 'Спринт 1 (закрыт)' },
    })
    expect(wrapper.text()).toContain('Спринт 1 (закрыт)')
  })

  it('рендерит «Бэклог», когда sprintTitle передан как null', () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), sprintTitle: null },
    })
    expect(wrapper.text()).toContain('Бэклог')
  })

  it('эмитит select с ключом sprint при клике на чип', async () => {
    const wrapper = mount(TaskPropertyChips, {
      props: { ...baseProps(), sprintTitle: 'Спринт 2' },
    })
    const button = wrapper.findAll('button').find(b => b.text().includes('Спринт 2'))
    await button!.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['sprint'])
  })
})

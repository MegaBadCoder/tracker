import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupLinkActions from '@/features/projects/ui/GroupLinkActions.vue'

const projectId = 'c8581138-9470-4b3f-aa73-a9483787d5fb'
const groupId = '20a8a4ef-58ac-4649-97d8-050810863842'

afterEach(() => vi.unstubAllGlobals())

describe('ссылки эпика и истории', () => {
  it.each(['story', 'epic'] as const)('копирует и открывает страницу %s в её проекте', async (type) => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(GroupLinkActions, { props: { projectId, groupId, type } })
    const expected = `${window.location.origin}/tasks/project/${projectId}/group/${groupId}`
    expect(wrapper.get('a').attributes()).toMatchObject({ href: expected, target: '_blank', rel: 'noopener noreferrer' })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expected)
    expect(wrapper.get('[role="status"]').text()).toBe('Ссылка скопирована')
  })

  it.each([{ projectId: 'temp-project', groupId }, { projectId, groupId: 'temp-group' }])('не публикует временные идентификаторы %j', (ids) => {
    const wrapper = mount(GroupLinkActions, { props: { ...ids, type: 'story' } })
    expect(wrapper.find('a').exists()).toBe(false)
  })
})

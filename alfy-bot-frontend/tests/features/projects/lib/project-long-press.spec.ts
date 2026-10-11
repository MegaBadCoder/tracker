import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useProjectTreeDrag } from '@/features/projects/lib/use-project-tree-drag'
import type { ProjectTreeNode } from '@/features/projects/model/types'

const node = { id: 'a', parentId: null, title: 'A', order: 0, children: [] } as unknown as ProjectTreeNode

function setup() {
  let controller!: ReturnType<typeof useProjectTreeDrag>
  const wrapper = mount(defineComponent({
    setup() {
      controller = useProjectTreeDrag(ref(null), () => [node], () => new Set(), () => false, vi.fn())
      return () => null
    },
  }))
  const event = new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 30, clientY: 50 })
  controller.start({ node, depth: 0 }, event)
  return { controller, wrapper }
}

describe('удержание проекта', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('начинает перенос после удержания без движения', () => {
    const { controller, wrapper } = setup()
    vi.advanceTimersByTime(349)
    expect(controller.drag.value?.active).toBe(false)
    vi.advanceTimersByTime(1)
    expect(controller.drag.value?.active).toBe(true)
    wrapper.unmount()
  })

  it('раннее движение отменяет перенос для прокрутки', () => {
    const { controller, wrapper } = setup()
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 70 }))
    vi.advanceTimersByTime(500)
    expect(controller.drag.value).toBeNull()
    wrapper.unmount()
  })

  it('короткое нажатие не запускает перенос', () => {
    const { controller, wrapper } = setup()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 30, clientY: 50 }))
    vi.advanceTimersByTime(500)
    expect(controller.drag.value).toBeNull()
    wrapper.unmount()
  })

  it('размонтирование снимает таймер', () => {
    const { controller, wrapper } = setup()
    wrapper.unmount()
    vi.advanceTimersByTime(500)
    expect(controller.drag.value).toBeNull()
  })
})

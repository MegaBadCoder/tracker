import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import SprintMapCanvas from '@/features/projects/ui/SprintMapCanvas.vue'

const projectId = '00000000-0000-4000-8000-000000000001'
const taskId = '00000000-0000-4000-8000-000000000002'
const storyId = '00000000-0000-4000-8000-000000000003'

function node(kind: SprintMapNode['kind'], id: string, title: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title, statusLabel: 'В работе', statusCategory: 'in_progress', statusColor: null, done: 1, total: 2, outsideCount: 0, blockedReason: null, releases: [], children }
}

function tree() {
  return node('sprint', 'sprint', 'Ноябрь', [node('epic', 'epic', 'Оплата', [
    node('story', storyId, 'Принимать карты', [node('task', taskId, 'Проверить оплату'), node('task', 'task2', 'Отменить оплату')]),
  ])])
}

function render(root = tree(), readonly = false) {
  return mount(SprintMapCanvas, { props: { root, projectId, readonly }, attachTo: document.body })
}

function planeTransform(wrapper: ReturnType<typeof render>) {
  const transform = (wrapper.get('[data-testid="map-plane"]').element as HTMLElement).style.transform
  const values = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/)!
  return { x: Number(values[1]), y: Number(values[2]), scale: Number(values[3]) }
}

beforeEach(() => localStorage.removeItem('alfy-sprint-map-collapsed'))

describe('карта спринта', () => {
  it('показывает выпуск релиза отдельно от готовности задачи', async () => {
    const task = node('task', taskId, 'Готовая запись')
    task.releases = [{ id: 'release', name: 'Демо', status: 'planned' }]
    const wrapper = render(node('sprint', 'sprint', 'Спринт', [task]))
    expect(wrapper.get(`[data-map-node="task:${taskId}"]`).text()).toContain('Запланирован: Демо')
    await wrapper.setProps({ root: node('sprint', 'sprint', 'Спринт', [{ ...task, releases: [{ id: 'release', name: 'Демо', status: 'released' }] }]) })
    expect(wrapper.get(`[data-map-node="task:${taskId}"]`).text()).toContain('Выпущен: Демо')
    expect(wrapper.get(`[data-map-node="task:${taskId}"] [aria-label="Выполнено задач: 1 из 2"]`).exists()).toBe(true)
    wrapper.unmount()
  })

  it('вмещает все сто задач и плавно увеличивает масштаб после общего обзора', async () => {
    const root = node('sprint', 'large', 'Большой спринт', [node('ungrouped', 'ungrouped', 'Без эпика', Array.from({ length: 100 }, (_, index) => node('task', `task-${index}`, `Задача ${index}`)))])
    const wrapper = render(root)
    await wrapper.findAll('button').find(button => button.text() === 'Вся карта')!.trigger('click')
    const plane = wrapper.get('[data-testid="map-plane"]').element as HTMLElement
    const before = planeTransform(wrapper)
    expect(Number.parseFloat(plane.style.height) * before.scale).toBeLessThanOrEqual(600)
    expect(before.y).toBeGreaterThanOrEqual(0)
    await wrapper.get('button[aria-label="Увеличить масштаб"]').trigger('click')
    expect(planeTransform(wrapper).scale).toBeCloseTo(before.scale * 1.2)
    wrapper.unmount()
  })

  it('сворачивает ветку с сохранением счётчиков и восстанавливает состояние только в её спринте и проекте', async () => {
    const wrapper = render()
    await wrapper.get('button[aria-label="Свернуть Принимать карты"]').trigger('click')
    expect(wrapper.find(`[data-map-node="task:${taskId}"]`).exists()).toBe(false)
    const story = wrapper.get(`[data-map-node="story:${storyId}"]`)
    expect(story.text()).toContain('Скрыто: 2')
    expect(story.get('[aria-label="Выполнено задач: 1 из 2"]').exists()).toBe(true)
    wrapper.unmount()
    const restored = render()
    expect(restored.find(`[data-map-node="task:${taskId}"]`).exists()).toBe(false)
    await restored.setProps({ root: { ...tree(), key: 'sprint:other' } })
    expect(restored.find(`[data-map-node="task:${taskId}"]`).exists()).toBe(true)
    await restored.setProps({ root: tree(), projectId: 'other-project' })
    expect(restored.find(`[data-map-node="task:${taskId}"]`).exists()).toBe(true)
    restored.unmount()
  })

  it('поиск раскрывает весь путь к скрытой задаче и переносит фокус на неё', async () => {
    const wrapper = render()
    await wrapper.get('button[aria-label="Свернуть Принимать карты"]').trigger('click')
    await wrapper.get('button[aria-label="Свернуть Оплата"]').trigger('click')
    await wrapper.get('button[aria-label="Свернуть Ноябрь"]').trigger('click')
    await wrapper.get('input[aria-label="Найти на карте"]').setValue('Проверить')
    expect(wrapper.get('[aria-label="Результаты поиска"]').text()).toContain('Проверить оплату')
    await wrapper.get('[aria-label="Результаты поиска"] button').trigger('click')
    await nextTick()
    const task = wrapper.get(`[data-map-node="task:${taskId}"]`)
    expect(document.activeElement).toBe(task.element)
    expect(wrapper.get('input').element.value).toBe('')
    expect(wrapper.emitted('openNode')).toBeUndefined()
    wrapper.unmount()
  })

  it('разделяет быстрый просмотр, обычную ссылку и добавление дочернего элемента', async () => {
    const wrapper = render()
    await wrapper.get('button[aria-label="Быстрый просмотр: Проверить оплату"]').trigger('click')
    expect(wrapper.emitted('openNode')?.[0]?.[0]).toMatchObject({ key: `task:${taskId}` })
    expect(wrapper.get('a[aria-label="Открыть страницу: Проверить оплату"]').attributes('href')).toBe(`/tasks/${taskId}`)
    expect(wrapper.get('a[aria-label="Открыть страницу: Принимать карты"]').attributes('href')).toBe(`/tasks/project/${projectId}/group/${storyId}`)
    await wrapper.get('button[aria-label="Свернуть Принимать карты"]').trigger('click')
    await wrapper.get('button[aria-label="Добавить задачу: Принимать карты"]').trigger('click')
    expect(wrapper.emitted('addChild')?.[0]?.[0]).toMatchObject({ key: `story:${storyId}` })
    expect(wrapper.find(`[data-map-node="task:${taskId}"]`).exists()).toBe(true)
    await wrapper.setProps({ readonly: true })
    expect(wrapper.find('button[aria-label^="Добавить"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Быстрый просмотр: Проверить оплату"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('удерживает сворачиваемый узел в прежней точке экрана', async () => {
    const wrapper = render()
    await nextTick()
    const position = () => {
      const host = wrapper.get(`[data-map-node="story:${storyId}"]`).element.parentElement!
      return Number.parseFloat(host.style.top) * planeTransform(wrapper).scale + planeTransform(wrapper).y
    }
    const before = position()
    await wrapper.get('button[aria-label="Свернуть Принимать карты"]').trigger('click')
    await nextTick()
    expect(position()).toBeCloseTo(before)
    wrapper.unmount()
  })

  it('масштабирует вокруг указателя, а панорама не меняет данные и не создаёт элементы', async () => {
    const root = tree()
    const snapshot = JSON.stringify(root)
    const wrapper = render(root)
    await nextTick()
    const surface = wrapper.get('[aria-label^="Полотно:"]')
    const before = planeTransform(wrapper)
    await surface.trigger('wheel', { ctrlKey: true, deltaY: -20, clientX: 120, clientY: 80 })
    const after = planeTransform(wrapper)
    expect((120 - after.x) / after.scale).toBeCloseTo((120 - before.x) / before.scale)
    expect((80 - after.y) / after.scale).toBeCloseTo((80 - before.y) / before.scale)
    await surface.trigger('pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 20 })
    await surface.trigger('pointermove', { pointerId: 1, clientX: 50, clientY: 70 })
    await surface.trigger('pointerup', { pointerId: 1 })
    expect(planeTransform(wrapper).x).toBeCloseTo(after.x + 40)
    expect(planeTransform(wrapper).y).toBeCloseTo(after.y + 50)
    expect(JSON.stringify(root)).toBe(snapshot)
    expect(wrapper.emitted('addChild')).toBeUndefined()
    expect(wrapper.emitted('openNode')).toBeUndefined()
    wrapper.unmount()
  })

  it('не начинает панораму с кнопки карточки и не перехватывает её клавиатуру', async () => {
    const wrapper = render()
    await nextTick()
    const before = planeTransform(wrapper)
    const control = wrapper.get('button[aria-label="Быстрый просмотр: Проверить оплату"]')
    await control.trigger('pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 20 })
    const surface = wrapper.get('[aria-label^="Полотно:"]')
    await surface.trigger('pointermove', { pointerId: 1, clientX: 50, clientY: 70 })
    await control.trigger('keydown', { key: 'ArrowRight' })
    expect(planeTransform(wrapper)).toEqual(before)
    await surface.trigger('keydown', { key: 'ArrowRight' })
    expect(planeTransform(wrapper).x).toBeCloseTo(before.x - 64)
    wrapper.unmount()
  })
})

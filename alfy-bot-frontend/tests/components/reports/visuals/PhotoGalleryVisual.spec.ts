import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoGalleryVisual from '@/components/reports/visuals/PhotoGalleryVisual.vue'
import type { PhotoGalleryEntry } from '@/api/reports'

const makeEntries = (count: number): PhotoGalleryEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    scheduled_date: `2024-0${i + 1}-15`,
    url: `https://cdn.example.com/photo${i + 1}.jpg`,
  }))

describe('PhotoGalleryVisual', () => {
  it('рендерит по одному <img> на каждый элемент', () => {
    const entries = makeEntries(3)
    const wrapper = mount(PhotoGalleryVisual, {
      props: { questionText: 'Как дела?', entries },
      attachTo: document.body,
    })

    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(3)
    imgs.forEach((img, i) => {
      expect(img.attributes('src')).toBe(entries[i].url)
    })

    wrapper.unmount()
  })

  it('порядок элементов в DOM совпадает с порядком entries (DESC от родителя — компонент не пересортирует)', () => {
    const entries = makeEntries(4)
    const wrapper = mount(PhotoGalleryVisual, {
      props: { questionText: 'Вопрос', entries },
      attachTo: document.body,
    })

    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(4)
    imgs.forEach((img, i) => {
      expect(img.attributes('src')).toBe(entries[i].url)
    })

    wrapper.unmount()
  })

  it('отображает empty state "Пока нет фото" при пустом массиве', () => {
    const wrapper = mount(PhotoGalleryVisual, {
      props: { questionText: 'Вопрос', entries: [] },
    })

    expect(wrapper.text()).toContain('Пока нет фото')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })

  it('открывает lightbox при клике на ячейку и закрывает при клике по overlay', async () => {
    const entries = makeEntries(2)
    const wrapper = mount(PhotoGalleryVisual, {
      props: { questionText: 'Фото', entries },
      attachTo: document.body,
    })

    // Initially no lightbox overlay (check in document.body since Teleport renders there)
    expect(document.body.querySelector('[data-testid="lightbox-overlay"]')).toBeNull()

    // Click on first cell button
    const cells = wrapper.findAll('button[data-testid="gallery-cell"]')
    expect(cells).toHaveLength(2)
    await cells[0].trigger('click')

    // Lightbox should be visible (in document.body via Teleport)
    const overlay = document.body.querySelector('[data-testid="lightbox-overlay"]')
    expect(overlay).not.toBeNull()

    // Click overlay to close
    overlay!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[data-testid="lightbox-overlay"]')).toBeNull()

    wrapper.unmount()
  })
})

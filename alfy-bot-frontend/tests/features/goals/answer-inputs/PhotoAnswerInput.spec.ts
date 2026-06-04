import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import PhotoAnswerInput from '@/features/goals/ui/answer-inputs/PhotoAnswerInput.vue'

beforeAll(() => {
  // happy-dom может не иметь URL.createObjectURL — мокаем для превью
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  })
})

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
}

describe('photo answer input', () => {
  it('не эмитит submitPhoto, пока файл не выбран', () => {
    const wrapper = mount(PhotoAnswerInput)
    // кнопка «Загрузить» отсутствует / disabled до выбора файла
    expect(wrapper.emitted('submitPhoto')).toBeFalsy()
  })

  it('после выбора файла и клика «Загрузить» эмитит submitPhoto с File', async () => {
    const wrapper = mount(PhotoAnswerInput)
    const file = makeFile()

    const input = wrapper.find('input[type="file"]')
    expect(input.exists()).toBe(true)

    // подкладываем файл в input и триггерим change
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')

    await wrapper.find('[data-testid="photo-upload"]').trigger('click')

    const events = wrapper.emitted('submitPhoto')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    const emitted = events![0][0] as File
    expect(emitted).toBeInstanceOf(File)
    expect(emitted.name).toBe('photo.jpg')
    expect(emitted.type).toBe('image/jpeg')
  })
})

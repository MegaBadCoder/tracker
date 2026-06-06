import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SettingsView from '@/views/SettingsView.vue'

vi.mock('@/stores/user-store', () => ({
  useUserStore: () => ({
    timezone: 'Europe/Moscow',
    user: { hasEmailAuth: true },
    updateTimezone: vi.fn(),
    fetchMe: vi.fn(),
  }),
}))

vi.mock('@/api/auth', () => ({
  linkEmail: vi.fn(),
  changePassword: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

function mountView() {
  return mount(SettingsView, {
    global: { stubs: { AppHeader: true, 'router-link': true } },
  })
}

function timezoneInput(wrapper: ReturnType<typeof mountView>) {
  // Поле часового пояса — единственный plain <input> с placeholder, содержащим "UTC".
  return wrapper
    .findAll('input')
    .find((i) => (i.attributes('placeholder') ?? '').includes('UTC'))!
}

describe('settingsView — выбор часового пояса', () => {
  it('по умолчанию показывает популярные зоны (Москва)', async () => {
    const wrapper = mountView()
    await timezoneInput(wrapper).trigger('focus')
    expect(wrapper.text()).toContain('Москва (UTC+3)')
  })

  it('находит зону Аргентины через полный список IANA (регрессия: раньше её не было)', async () => {
    const wrapper = mountView()
    const input = timezoneInput(wrapper)
    await input.trigger('focus')
    await input.setValue('buenos')
    // Имя зоны зависит от версии ICU (America/Argentina/Buenos_Aires или легаси America/Buenos_Aires).
    expect(wrapper.text()).toMatch(/Buenos_Aires \(UTC-3\)/)
  })

  it('русский поиск по популярным зонам продолжает работать', async () => {
    const wrapper = mountView()
    const input = timezoneInput(wrapper)
    await input.trigger('focus')
    await input.setValue('екатеринбург')
    expect(wrapper.text()).toContain('Екатеринбург (UTC+5)')
  })
})

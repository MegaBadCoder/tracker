import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorize, authorizeWithWidget, loginWithEmail, resetPassword, verifyEmail } from '@/api/auth'
import LoginView from '@/views/LoginView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import VerifyEmailView from '@/views/VerifyEmailView.vue'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), fetchMe: vi.fn(), setUser: vi.fn(), query: { redirect: '/tasks/task-id', email: 'user@example.com' } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }))
vi.mock('@/api/auth', () => ({ authorize: vi.fn(), authorizeWithWidget: vi.fn(), loginWithEmail: vi.fn(), register: vi.fn(), verifyEmail: vi.fn(), resendCode: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() }))
vi.mock('@/stores/user-store', () => ({ useUserStore: () => ({ fetchMe: mocks.fetchMe, setUser: mocks.setUser }) }))
vi.mock('@/composables/useCooldown', () => ({ useCooldown: () => ({ cooldown: 0, start: vi.fn() }) }))
const global = { stubs: { Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' }, Button: { template: '<button><slot /></button>' } } }

describe('login redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.redirect = '/tasks/task-id'
    Object.defineProperty(window, 'Telegram', { configurable: true, value: undefined })
  })
  it('returns to the task after email login', async () => {
    const wrapper = mount(LoginView, { global })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(loginWithEmail).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith('/tasks/task-id')
    wrapper.unmount()
  })
  it('returns after Telegram widget login', async () => {
    vi.mocked(authorizeWithWidget).mockResolvedValue({ user: null } as never)
    const wrapper = mount(LoginView, { global })
    await window.onTelegramAuth!({ id: 1 } as never)
    expect(mocks.replace).toHaveBeenCalledWith('/tasks/task-id')
    wrapper.unmount()
  })
  it('returns after Telegram WebApp login', async () => {
    Object.defineProperty(window, 'Telegram', { configurable: true, value: { WebApp: { initData: 'data', ready: vi.fn() } } })
    vi.mocked(authorize).mockResolvedValue({ user: null } as never)
    const wrapper = mount(LoginView, { global })
    await flushPromises()
    expect(mocks.replace).toHaveBeenCalledWith('/tasks/task-id')
    wrapper.unmount()
  })
  it('rejects an external target', async () => {
    mocks.query.redirect = '//evil.test'
    const wrapper = mount(LoginView, { global })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.replace).toHaveBeenCalledWith('/')
    wrapper.unmount()
  })
  it('returns after email verification', async () => {
    const wrapper = mount(VerifyEmailView, { global })
    await wrapper.find('input').setValue('123456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(verifyEmail).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith('/tasks/task-id')
    wrapper.unmount()
  })
  it('returns after password reset', async () => {
    const wrapper = mount(ResetPasswordView, { global })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('123456')
    await inputs[1]!.setValue('password')
    await inputs[2]!.setValue('password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(resetPassword).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith('/tasks/task-id')
    wrapper.unmount()
  })
})

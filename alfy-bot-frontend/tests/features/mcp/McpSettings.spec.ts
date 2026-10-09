import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import McpSettings from '@/features/mcp/ui/McpSettings.vue'

const { listTokens, createToken, revokeToken, confirm } = vi.hoisted(() => ({
  listTokens: vi.fn(),
  createToken: vi.fn(),
  revokeToken: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('@/features/mcp/api/tokens', () => ({ listTokens, createToken, revokeToken }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))

const sample = { id: 1, name: 'Claude', prefix: '0123456789', created_at: '2026-10-09T10:00:00Z', last_used_at: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn(() => null) })
  listTokens.mockResolvedValue([sample])
  createToken.mockResolvedValue({ id: 2, plaintext: 'secret-from-user' })
  revokeToken.mockResolvedValue(undefined)
  confirm.mockResolvedValue(true)
})

async function ready() {
  const wrapper = mount(McpSettings)
  await flushPromises()
  return wrapper
}

describe('mCP в настройках', () => {
  it('показывает секрет после выдачи и не сохраняет его в storage', async () => {
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="mcp-secret"]').attributes('value')).toBe('secret-from-user')
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('сохраняет показанный секрет при ошибке обновления списка', async () => {
    listTokens.mockResolvedValueOnce([sample]).mockRejectedValueOnce(new Error('offline'))
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="mcp-secret"]').attributes('value')).toBe('secret-from-user')
    expect(wrapper.text()).toContain('Не удалось загрузить список токенов')
  })

  it('не отправляет повторное создание, пока запрос выполняется', async () => {
    let finish!: (value: { id: number, plaintext: string }) => void
    createToken.mockReturnValue(new Promise((resolve) => {
      finish = resolve
    }))
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(createToken).toHaveBeenCalledTimes(1)
    finish({ id: 2, plaintext: 'secret-from-user' })
    await flushPromises()
  })

  it('не создаёт токен до завершения загрузки списка', async () => {
    let finish!: (value: typeof sample[]) => void
    listTokens.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))
    const wrapper = mount(McpSettings)
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    expect(createToken).not.toHaveBeenCalled()
    finish([sample])
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createToken).toHaveBeenCalledTimes(1)
  })

  it('показывает ошибку выдачи без автоматического повтора POST', async () => {
    createToken.mockRejectedValue(new Error('offline'))
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось создать токен')
    expect(createToken).toHaveBeenCalledTimes(1)
  })

  it('показывает ошибку отзыва и оставляет токен в списке', async () => {
    revokeToken.mockRejectedValue(new Error('offline'))
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-revoke-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось отозвать токен')
    expect(wrapper.get('[data-testid="mcp-revoke-1"]').exists()).toBe(true)
  })

  it('отзывает после подтверждения и очищает секрет отозванного токена', async () => {
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    listTokens.mockResolvedValueOnce([{ ...sample, id: 2 }])
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="mcp-revoke-2"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(revokeToken).toHaveBeenCalledWith(2)
    expect(wrapper.find('[data-testid="mcp-secret"]').exists()).toBe(false)
  })

  it('показывает ошибку копирования и оставляет секрет для ручного копирования', async () => {
    const wrapper = await ready()
    await wrapper.get('[data-testid="mcp-token-name"]').setValue('Claude Code')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await wrapper.get('[data-testid="mcp-copy-secret"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось скопировать')
    expect(wrapper.get('[data-testid="mcp-secret"]').element).toBeInstanceOf(HTMLTextAreaElement)
  })
})

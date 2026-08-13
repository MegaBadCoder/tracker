import { describe, it, expect, beforeEach } from 'vitest'
import { useConfirm } from '@/composables/useConfirm'

const KEY = 'alfy:skip-materialize-confirm'

if (typeof globalThis.localStorage?.removeItem !== 'function') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('useConfirm — rememberKey', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
    const { isOpen, handleCancel } = useConfirm()
    if (isOpen.value) handleCancel()
  })

  it('не открывает диалог, если localStorage[rememberKey] === "1"', async () => {
    localStorage.setItem(KEY, '1')
    const { confirm, isOpen } = useConfirm()

    const result = await confirm({
      title: 'Проявить?',
      message: '',
      rememberKey: KEY,
    })

    expect(result).toBe(true)
    expect(isOpen.value).toBe(false)
  })

  it('открывает диалог, если ключа нет', async () => {
    const { confirm, isOpen, handleCancel } = useConfirm()
    const pending = confirm({
      title: 'Проявить?',
      message: '',
      rememberKey: KEY,
    })

    expect(isOpen.value).toBe(true)
    handleCancel()
    expect(await pending).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('пишет ключ только по Confirm, не по Cancel', async () => {
    const { confirm, rememberChecked, handleConfirm, handleCancel } = useConfirm()

    const cancelled = confirm({
      title: 'Проявить?',
      message: '',
      rememberKey: KEY,
      rememberLabel: 'Больше не показывать',
    })
    rememberChecked.value = true
    handleCancel()
    expect(await cancelled).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()

    const confirmed = confirm({
      title: 'Проявить?',
      message: '',
      rememberKey: KEY,
    })
    rememberChecked.value = true
    handleConfirm()
    expect(await confirmed).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('1')
  })
})

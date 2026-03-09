import { ref, shallowRef } from 'vue'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

const isOpen = ref(false)
const options = shallowRef<ConfirmOptions | null>(null)
let resolvePromise: ((value: boolean) => void) | null = null

const resolve = (value: boolean) => {
  if (resolvePromise) {
    isOpen.value = false
    resolvePromise(value)
    resolvePromise = null
  }
}

export function useConfirm() {
  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    options.value = opts
    isOpen.value = true
    return new Promise((res) => {
      resolvePromise = res
    })
  }

  const handleConfirm = () => resolve(true)
  const handleCancel = () => resolve(false)

  return { isOpen, options, confirm, handleConfirm, handleCancel }
}

import { ref, shallowRef } from 'vue'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  rememberKey?: string
  rememberLabel?: string
}

const isOpen = ref(false)
const options = shallowRef<ConfirmOptions | null>(null)
const rememberChecked = ref(false)
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
    if (opts.rememberKey && localStorage.getItem(opts.rememberKey) === '1') {
      return Promise.resolve(true)
    }
    rememberChecked.value = false
    options.value = opts
    isOpen.value = true
    return new Promise((res) => {
      resolvePromise = res
    })
  }

  const handleConfirm = () => {
    if (options.value?.rememberKey && rememberChecked.value) {
      localStorage.setItem(options.value.rememberKey, '1')
    }
    resolve(true)
  }
  const handleCancel = () => resolve(false)

  return { isOpen, options, confirm, handleConfirm, handleCancel, rememberChecked }
}

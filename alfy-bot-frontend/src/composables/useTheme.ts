import { ref, watch } from 'vue'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'alfy_theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): Theme {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  return theme
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', resolve(theme) === 'dark')
}

// Apply once at import time to prevent FOUC before app mounts.
export function initTheme(): void {
  apply(readStored())
}

const theme = ref<Theme>(readStored())
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

function setupMediaListener(): void {
  if (mediaListener) return
  mediaListener = () => {
    if (theme.value === 'system') apply('system')
  }
  matchMedia(DARK_QUERY).addEventListener('change', mediaListener)
}

watch(theme, (v) => {
  localStorage.setItem(STORAGE_KEY, v)
  apply(v)
}, { immediate: false })

export function useTheme() {
  setupMediaListener()
  return {
    theme,
    setTheme: (v: Theme) => { theme.value = v },
  }
}

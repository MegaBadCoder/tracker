import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'last_section_path'

const TRACKED_SECTIONS = ['/', '/habits', '/tasks', '/settings'] as const
export type Section = typeof TRACKED_SECTIONS[number]

function isSection(value: string): value is Section {
  return (TRACKED_SECTIONS as readonly string[]).includes(value)
}

export function getTopSection(path: string): Section | null {
  const seg = path.split('/')[1] ?? ''
  switch (seg) {
    case '': return '/'
    case 'habits': return '/habits'
    case 'tasks': return '/tasks'
    case 'settings': return '/settings'
    case 'goals':
    case 'questions':
      return '/'
    default:
      return null
  }
}

export const useNavigationStore = defineStore('navigation', () => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  const lastSection = ref<Section | null>(stored && isSection(stored) ? stored : null)

  function rememberSection(path: string) {
    const section = getTopSection(path)
    if (!section || section === lastSection.value) return
    lastSection.value = section
    localStorage.setItem(STORAGE_KEY, section)
  }

  return { lastSection, rememberSection }
})

import type { Ref } from 'vue'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'show_completed_tasks'

type Scope = string

function loadAll(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  }
  catch {
    return {}
  }
}

function saveAll(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  }
  catch {
    // ignore quota / privacy mode failures
  }
}

export function useShowCompleted(scope: Ref<Scope> | Scope): Ref<boolean> {
  const getScope = () => (typeof scope === 'string' ? scope : scope.value)
  const showCompleted = ref(loadAll()[getScope()] ?? true)

  if (typeof scope !== 'string') {
    watch(scope, (s) => {
      showCompleted.value = loadAll()[s] ?? true
    })
  }

  watch(showCompleted, (v) => {
    const cur = loadAll()
    cur[getScope()] = v
    saveAll(cur)
  })

  return showCompleted
}

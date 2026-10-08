import { readonly, ref } from 'vue'

interface GroupDetailTarget {
  projectId: string
  groupId: string
}

const current = ref<GroupDetailTarget | null>(null)

function open(projectId: string, groupId: string): void {
  current.value = { projectId, groupId }
}

function close(): void {
  current.value = null
}

/**
 * Модульный синглтон открытой карточки эпика/истории: какая группа какого
 * проекта сейчас показана в модалке. Состояние общее для всех вызовов —
 * это одна модалка на всё приложение, а не собственный стейт компонента.
 */
export function useGroupDetail() {
  return {
    current: readonly(current),
    open,
    close,
  }
}

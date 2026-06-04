<script setup lang="ts">
import type { NavLink } from '@/types/navigation'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useDropTarget } from '@/features/tasks/lib/dnd/use-drop-target'

defineProps<{ links: NavLink[] }>()

const route = useRoute()

function isLinkActive(to: string): boolean {
  const [path, queryStr] = to.split('?')
  if (route.path !== path)
    return false
  if (queryStr === undefined) {
    // plain link (e.g. "/") is active only when there is no scope query
    return route.query.scope === undefined
  }
  const linkScope = new URLSearchParams(queryStr).get('scope')
  return route.query.scope === linkScope
}

const inboxLinkEl = ref<HTMLElement | null>(null)
const inboxEl = computed<HTMLElement | null>(() => inboxLinkEl.value)

const { isHovered: isInboxHovered } = useDropTarget({
  id: 'inbox',
  kind: 'inbox',
  el: inboxEl,
})
</script>

<template>
  <nav class="flex flex-col gap-0.5 px-4">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :ref="link.to === '/tasks' ? (el: any) => { inboxLinkEl = el?.$el ?? null } : undefined"
      :to="link.to"
      :data-drop-kind="link.to === '/tasks' ? 'inbox' : undefined"
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
      :class="[
        isLinkActive(link.to)
          ? 'bg-sidebar-accent text-sidebar-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
        link.to === '/tasks' && isInboxHovered ? 'bg-accent ring-2 ring-primary' : '',
      ]"
    >
      <component :is="link.icon" class="h-4 w-4" />
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

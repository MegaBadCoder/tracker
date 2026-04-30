<script setup lang="ts">
import type { NavLink } from '@/types/navigation'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useDropTarget } from '@/features/tasks/lib/dnd/use-drop-target'

defineProps<{ links: NavLink[] }>()

const route = useRoute()

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
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
      :class="[
        route.path === link.to
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

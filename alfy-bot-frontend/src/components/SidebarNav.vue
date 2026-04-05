<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import type { NavLink } from '@/types/navigation'

defineProps<{ links: NavLink[] }>()

const route = useRoute()
</script>

<template>
  <nav class="flex flex-col gap-0.5 px-4">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
      :class="route.path === link.to
        ? 'bg-sidebar-accent text-sidebar-primary'
        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'"
    >
      <component :is="link.icon" class="h-4 w-4" />
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

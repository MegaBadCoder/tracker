<script setup lang="ts">
import { ref, provide, computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import type { NavLink } from '@/types/navigation'
import { tasksNavLinks } from '@/router/tasks-nav'

const route = useRoute()
const sidebarOpen = ref(false)

const sectionNavRegistry: Record<string, NavLink[]> = {
  tasks: tasksNavLinks,
}

const sectionLinks = computed<NavLink[] | undefined>(() => {
  const key = route.matched.find(r => r.meta.sectionNav)?.meta.sectionNav as string | undefined
  return key ? sectionNavRegistry[key] : undefined
})

function openSidebar() {
  sidebarOpen.value = true
}

function closeSidebar() {
  sidebarOpen.value = false
}

provide('openSidebar', openSidebar)
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar :open="sidebarOpen" :links="sectionLinks" @close="closeSidebar" />
    <div class="flex-1 min-w-0">
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { NavLink } from '@/types/navigation'
import { computed, defineAsyncComponent, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { goalsNavLinks } from '@/router/goals-nav'
import { habitsNavLinks } from '@/router/habits-nav'
import { tasksNavLinks } from '@/router/tasks-nav'
import AppSidebar from './AppSidebar.vue'

const TasksSidebarSection = defineAsyncComponent(() =>
  import('./TasksSidebarSection.vue'),
)

const route = useRoute()
const sidebarOpen = ref(false)
const desktopCollapsed = ref(false)
const isTasksSection = computed(() => route.matched.some(record => record.meta.sectionNav === 'tasks'))
const desktopSidebarCollapsed = computed(() => isTasksSection.value && desktopCollapsed.value)

const sectionNavRegistry: Record<string, NavLink[]> = {
  tasks: tasksNavLinks,
  habits: habitsNavLinks,
  goals: goalsNavLinks,
}

const sectionExtraRegistry: Record<string, Component> = {
  tasks: TasksSidebarSection,
}

const sectionLinks = computed<NavLink[] | undefined>(() => {
  const key = route.matched.find(r => r.meta.sectionNav)?.meta.sectionNav as string | undefined
  return key ? sectionNavRegistry[key] : undefined
})

const sectionExtra = computed<Component | undefined>(() => {
  const key = route.matched.find(r => r.meta.sectionNav)?.meta.sectionNav as string | undefined
  return key ? sectionExtraRegistry[key] : undefined
})

function openSidebar() {
  if (window.matchMedia('(min-width: 640px)').matches) desktopCollapsed.value = false
  else sidebarOpen.value = true
}

function closeSidebar() {
  sidebarOpen.value = false
}

watch(() => route.path, () => closeSidebar())

provide('openSidebar', openSidebar)
provide('desktopSidebarCollapsed', desktopSidebarCollapsed)
</script>

<template>
  <div class="flex min-h-[100dvh]">
    <AppSidebar :open="sidebarOpen" :links="sectionLinks" :collapsible="isTasksSection" :desktop-collapsed="desktopSidebarCollapsed" @collapse="desktopCollapsed = true" @close="closeSidebar" @open="openSidebar">
      <template v-if="sectionExtra" #section-extra>
        <component :is="sectionExtra" />
      </template>
    </AppSidebar>
    <div class="flex-1 min-w-0">
      <RouterView />
    </div>
  </div>
</template>

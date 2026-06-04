<script setup lang="ts">
import type { Component } from 'vue'
import type { NavLink } from '@/types/navigation'
import { computed, defineAsyncComponent, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { goalsNavLinks } from '@/router/goals-nav'
import { tasksNavLinks } from '@/router/tasks-nav'
import AppSidebar from './AppSidebar.vue'

const ProjectTreeNav = defineAsyncComponent(() =>
  import('@/features/projects/ui/ProjectTreeNav.vue'),
)

const route = useRoute()
const sidebarOpen = ref(false)

const sectionNavRegistry: Record<string, NavLink[]> = {
  tasks: tasksNavLinks,
  goals: goalsNavLinks,
}

const sectionExtraRegistry: Record<string, Component> = {
  tasks: ProjectTreeNav,
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
  sidebarOpen.value = true
}

function closeSidebar() {
  sidebarOpen.value = false
}

provide('openSidebar', openSidebar)
</script>

<template>
  <div class="flex min-h-[100dvh]">
    <AppSidebar :open="sidebarOpen" :links="sectionLinks" @close="closeSidebar" @open="openSidebar">
      <template v-if="sectionExtra" #section-extra>
        <component :is="sectionExtra" />
      </template>
    </AppSidebar>
    <div class="flex-1 min-w-0">
      <RouterView />
    </div>
  </div>
</template>

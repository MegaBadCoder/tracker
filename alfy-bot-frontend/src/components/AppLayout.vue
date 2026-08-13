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
  sidebarOpen.value = true
}

function closeSidebar() {
  sidebarOpen.value = false
}

// На мобильной версии sidebar — оверлей; после перехода по разделу его надо свернуть.
// На десктопе панель видна всегда (CSS), поэтому вызов безвреден.
watch(() => route.path, () => closeSidebar())

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

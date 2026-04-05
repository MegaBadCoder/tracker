<script setup lang="ts">
import UserSection from './UserSection.vue'
import SidebarNav from './SidebarNav.vue'
import type { NavLink } from '@/types/navigation'
import { navLinks } from '@/router/nav'

defineProps<{
  open: boolean
  links?: NavLink[]
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <!-- Desktop sidebar -->
  <aside class="hidden sm:flex flex-col w-52 flex-shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
    <div class="p-4 pt-5">
      <UserSection :links="navLinks" />
    </div>
    <SidebarNav v-if="links?.length" :links="links" />
  </aside>

  <!-- Mobile overlay -->
  <Teleport to="body">
    <Transition name="sidebar">
      <div v-if="open" class="fixed inset-0 z-40 sm:hidden">
        <!-- backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
        <!-- panel -->
        <aside class="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-lg">
          <div class="p-4 pt-5">
            <UserSection :links="navLinks" />
          </div>
          <SidebarNav v-if="links?.length" :links="links" />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-enter-active aside,
.sidebar-leave-active aside {
  transition: transform 0.2s ease;
}
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}
.sidebar-enter-from aside,
.sidebar-leave-to aside {
  transform: translateX(-100%);
}
</style>

<script setup lang="ts">
import { ref, provide } from 'vue'
import AppSidebar from './AppSidebar.vue'

const sidebarOpen = ref(false)

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
    <AppSidebar :open="sidebarOpen" @close="closeSidebar" />
    <div class="flex-1 min-w-0">
      <RouterView />
    </div>
  </div>
</template>

<template>
  <AppHeader title="Календарь" :on-menu-click="openSidebar" />
  <main class="px-4 py-6">
    <WeeklyCalendar />
  </main>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { WeeklyCalendar } from '@/features/calendar'
import AppHeader from '@/components/AppHeader.vue'

const openSidebar = inject<() => void>('openSidebar', () => {})
</script>

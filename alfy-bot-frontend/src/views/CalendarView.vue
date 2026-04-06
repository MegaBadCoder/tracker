<template>
  <div class="flex flex-col h-[100dvh]">
    <AppHeader title="Календарь" :on-menu-click="openSidebar" fluid />
    <main class="flex-1 min-h-0 px-4 py-2 pb-4">
      <WeeklyCalendar class="h-full" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { WeeklyCalendar } from '@/features/calendar'
import AppHeader from '@/components/AppHeader.vue'

const openSidebar = inject<() => void>('openSidebar', () => {})
</script>

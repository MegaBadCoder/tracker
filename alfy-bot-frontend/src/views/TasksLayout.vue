<template>
  <RouterView />
  <Teleport to="body">
    <TimeBlock />
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, provide } from 'vue'
import { useProjectStore } from '@/features/projects/model/project-store'
import { TimeBlock } from '@/features/task-timer'

const projectStore = useProjectStore()
provide('taskTimerAvailable', true)

onMounted(() => {
  if (projectStore.projects.length === 0) {
    projectStore.fetchProjects()
  }
})
</script>

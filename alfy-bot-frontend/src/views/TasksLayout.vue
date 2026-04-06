<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectStore } from '@/features/projects/model/project-store'

const projectStore = useProjectStore()

onMounted(() => {
  if (projectStore.projects.length === 0) {
    projectStore.fetchProjects()
  }
})
</script>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useProjectStore } from '@/features/projects/model/project-store'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
</script>

<template>
  <div class="flex flex-col">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" fluid />
    <div class="px-4 py-3">
      <ProjectTabs :project-id="projectId" />
    </div>
  </div>
</template>

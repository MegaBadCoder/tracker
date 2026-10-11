<script setup lang="ts">
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import GroupDetailDialog from '@/features/projects/ui/GroupDetailDialog.vue'
import TaskDragGhost from '@/features/tasks/ui/TaskDragGhost.vue'
</script>

<template>
  <div class="min-h-[100dvh] transition-colors">
    <RouterView />
    <ConfirmDialog />
    <GroupDetailDialog />
    <TaskDragGhost />
  </div>
</template>

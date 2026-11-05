<script setup lang="ts">
import { computed } from 'vue'
import EntityLinkActions from '@/components/EntityLinkActions.vue'
import { taskLinkPath } from '../lib/task-link'

const props = defineProps<{ taskId: string }>()
const path = computed(() => taskLinkPath(props.taskId))
</script>

<template>
  <EntityLinkActions :path="path" label="задачу" />
</template>

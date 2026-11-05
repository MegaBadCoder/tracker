<script setup lang="ts">
import { computed } from 'vue'
import EntityLinkActions from '@/components/EntityLinkActions.vue'
import { groupLinkPath } from '../lib/group-link'

const props = defineProps<{ projectId: string, groupId: string, type: 'epic' | 'story' }>()
const path = computed(() => groupLinkPath(props.projectId, props.groupId))
</script>

<template>
  <EntityLinkActions :path="path" :label="type === 'epic' ? 'эпик' : 'историю'" />
</template>

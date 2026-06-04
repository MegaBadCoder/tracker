<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { Loader2 } from 'lucide-vue-next'

defineProps<{ state: FlowState }>()
</script>

<template>
  <div class="flex items-center gap-3 py-6 text-muted-foreground">
    <Loader2 class="w-5 h-5 animate-spin" />
    <span>Создаём цель...</span>
  </div>
</template>

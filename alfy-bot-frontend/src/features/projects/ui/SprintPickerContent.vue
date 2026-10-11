<script setup lang="ts">
import { Check, Circle, Zap } from 'lucide-vue-next'
import { computed } from 'vue'
import { useSprintStore } from '../model/sprint-store'

const props = defineProps<{
  projectId: string
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const sprintStore = useSprintStore()

const options = computed(() => {
  const active = sprintStore.activeSprintOf(props.projectId)
  return [
    ...(active ? [active] : []),
    ...sprintStore.plannedSprintsOf(props.projectId),
  ]
})
</script>

<template>
  <div class="space-y-1">
    <button
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', null)"
    >
      <Circle :size="14" class="text-muted-foreground" />
      Бэклог
      <Check v-if="modelValue === null" :size="14" class="ml-auto text-primary" />
    </button>
    <div v-if="options.length > 0" class="h-px bg-border/40 my-1" />
    <button
      v-for="sprint in options"
      :key="sprint.id"
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', sprint.id)"
    >
      <Zap :size="14" class="shrink-0" :class="sprint.status === 'active' ? 'text-primary' : 'text-muted-foreground'" />
      <span class="truncate">{{ sprint.name }}</span>
      <Check v-if="modelValue === sprint.id" :size="14" class="ml-auto shrink-0 text-primary" />
    </button>
  </div>
</template>

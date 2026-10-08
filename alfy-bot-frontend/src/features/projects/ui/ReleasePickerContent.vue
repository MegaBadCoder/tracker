<script setup lang="ts">
import { Check, Circle, Rocket } from 'lucide-vue-next'
import { computed } from 'vue'
import { useReleaseStore } from '../model/release-store'

const props = defineProps<{
  projectId: string
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const releaseStore = useReleaseStore()

const options = computed(() => releaseStore.plannedReleasesOf(props.projectId))
</script>

<template>
  <div class="space-y-1">
    <button
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', null)"
    >
      <Circle :size="14" class="text-muted-foreground" />
      Без релиза
      <Check v-if="modelValue === null" :size="14" class="ml-auto text-primary" />
    </button>
    <div v-if="options.length > 0" class="h-px bg-border/40 my-1" />
    <button
      v-for="release in options"
      :key="release.id"
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', release.id)"
    >
      <Rocket :size="14" class="shrink-0 text-muted-foreground" />
      <span class="truncate">{{ release.name }}</span>
      <Check v-if="modelValue === release.id" :size="14" class="ml-auto shrink-0 text-primary" />
    </button>
  </div>
</template>

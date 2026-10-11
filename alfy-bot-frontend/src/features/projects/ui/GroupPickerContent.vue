<script setup lang="ts">
import { BookMarked, BookOpen, Check, Circle } from 'lucide-vue-next'
import { computed } from 'vue'
import { useGroupStore } from '../model/group-store'

const props = defineProps<{
  projectId: string
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const groupStore = useGroupStore()
const tree = computed(() => groupStore.groupsOf(props.projectId))
</script>

<template>
  <div class="space-y-1">
    <button
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', null)"
    >
      <Circle :size="14" class="text-muted-foreground" />
      Без эпика
      <Check v-if="modelValue === null" :size="14" class="ml-auto text-primary" />
    </button>
    <div class="h-px bg-border/40 my-1" />
    <template v-for="epic in tree" :key="epic.id">
      <button
        class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
        @click="$emit('update:modelValue', epic.id)"
      >
        <BookMarked :size="14" :style="epic.color ? { color: epic.color } : undefined" class="shrink-0" />
        <span class="truncate">{{ epic.title }}</span>
        <Check v-if="modelValue === epic.id" :size="14" class="ml-auto shrink-0 text-primary" />
      </button>
      <button
        v-for="story in epic.children"
        :key="story.id"
        class="flex items-center gap-2.5 w-full py-2.5 pr-3 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
        style="padding-left: 28px"
        @click="$emit('update:modelValue', story.id)"
      >
        <BookOpen :size="14" :style="story.color ? { color: story.color } : undefined" class="shrink-0" />
        <span class="truncate">{{ story.title }}</span>
        <Check v-if="modelValue === story.id" :size="14" class="ml-auto shrink-0 text-primary" />
      </button>
    </template>
  </div>
</template>

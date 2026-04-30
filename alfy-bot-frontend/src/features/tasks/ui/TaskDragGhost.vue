<script setup lang="ts">
import { computed } from 'vue'
import { useTaskDnd } from '../lib/dnd/use-task-dnd'

const dnd = useTaskDnd()

const style = computed(() => {
  const { active, pointer } = dnd.state
  if (!active)
    return {}
  return {
    left: `${pointer.x - active.ghostOffset.x}px`,
    top: `${pointer.y - active.ghostOffset.y}px`,
    width: `${active.originRect.width}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dnd.state.active"
      class="fixed z-[9999] pointer-events-none opacity-85 select-none rounded-lg border border-border bg-card shadow-lg px-3 py-2"
      :style="style"
    >
      <div class="flex items-center gap-2 min-w-0">
        <!-- Checkbox clone -->
        <div
          class="shrink-0 size-4 rounded border border-muted-foreground/50"
          :class="{ 'bg-primary border-primary': dnd.state.active.task.completed }"
        />
        <!-- Title clone -->
        <span class="truncate text-sm font-medium leading-snug">
          {{ dnd.state.active.task.title }}
        </span>
      </div>
    </div>
  </Teleport>
</template>

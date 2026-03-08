<script setup lang="ts">
import { Target, ListChecks } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const route = useRoute()

const links = [
  { to: '/', label: 'Цели', icon: Target },
  { to: '/habits', label: 'Привычки', icon: ListChecks },
]
</script>

<template>
  <!-- Desktop sidebar -->
  <aside class="hidden sm:flex flex-col w-52 flex-shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
    <div class="p-4 pt-5">
      <nav class="flex flex-col gap-1">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          :class="route.path === link.to
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'"
        >
          <component :is="link.icon" class="w-5 h-5" />
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>
  </aside>

  <!-- Mobile overlay -->
  <Teleport to="body">
    <Transition name="sidebar">
      <div v-if="open" class="fixed inset-0 z-40 sm:hidden">
        <!-- backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
        <!-- panel -->
        <aside class="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-lg">
          <div class="p-4 pt-5">
            <nav class="flex flex-col gap-1">
              <RouterLink
                v-for="link in links"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                :class="route.path === link.to
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'"
                @click="emit('close')"
              >
                <component :is="link.icon" class="w-5 h-5" />
                {{ link.label }}
              </RouterLink>
            </nav>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-enter-active aside,
.sidebar-leave-active aside {
  transition: transform 0.2s ease;
}
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}
.sidebar-enter-from aside,
.sidebar-leave-to aside {
  transform: translateX(-100%);
}
</style>

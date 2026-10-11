<script setup lang="ts">
import { ArrowLeft, Target, PanelLeftOpen } from 'lucide-vue-next'
import { inject, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  title: string
  showBack?: boolean
  fluid?: boolean
  onMenuClick?: () => void
}>()

const router = useRouter()
const desktopSidebarCollapsed = inject<Ref<boolean>>('desktopSidebarCollapsed', ref(false))
</script>

<template>
  <header class="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
    <div :class="['px-4 h-14 flex items-center gap-3', !fluid && 'max-w-6xl mx-auto']">
      <!-- left -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <Button
          v-if="showBack"
          variant="ghost"
          size="icon"
          class="flex-shrink-0"
          @click="router.back()"
        >
          <ArrowLeft class="w-5 h-5" />
        </Button>
        <Button
          v-if="onMenuClick && !showBack"
          variant="ghost"
          size="icon"
          class="flex-shrink-0"
          :class="desktopSidebarCollapsed ? '' : 'sm:hidden'"
          aria-label="Открыть боковое меню"
          title="Открыть боковое меню"
          @click="onMenuClick"
        >
          <PanelLeftOpen class="w-5 h-5" />
        </Button>
        <Target v-else-if="!showBack" class="w-5 h-5 text-primary flex-shrink-0" />
        <slot name="title">
          <span class="font-semibold text-base truncate">{{ title }}</span>
        </slot>
      </div>

      <!-- right slot -->
      <slot name="right" />
    </div>
  </header>
</template>

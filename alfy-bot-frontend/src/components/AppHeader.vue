<script setup lang="ts">
import { ArrowLeft, Target } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  title: string
  showBack?: boolean
}>()

const router = useRouter()
</script>

<template>
  <header class="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
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
        <Target v-else class="w-5 h-5 text-primary flex-shrink-0" />
        <span class="font-semibold text-base truncate">{{ title }}</span>
      </div>

      <!-- right slot -->
      <slot name="right" />
    </div>
  </header>
</template>

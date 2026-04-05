<script setup lang="ts">
import type { AvatarFallbackProps } from "reka-ui"
import { AvatarFallback } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<AvatarFallbackProps & { class?: string }>(), {
  class: '',
})
</script>

<template>
  <AvatarFallback
    data-slot="avatar-fallback"
    :class="cn('flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium', props.class)"
  >
    <slot />
  </AvatarFallback>
</template>

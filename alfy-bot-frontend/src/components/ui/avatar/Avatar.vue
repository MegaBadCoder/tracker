<script setup lang="ts">
import type { AvatarRootProps } from "reka-ui"
import { AvatarRoot } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<AvatarRootProps & { class?: string }>(), {
  class: '',
})
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    :class="cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full', props.class)"
  >
    <slot />
  </AvatarRoot>
</template>

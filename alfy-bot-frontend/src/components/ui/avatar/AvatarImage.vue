<script setup lang="ts">
import type { AvatarImageProps } from "reka-ui"
import { AvatarImage } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<AvatarImageProps & { class?: string }>(), {
  class: '',
})
</script>

<template>
  <AvatarImage
    data-slot="avatar-image"
    :src="props.src"
    :class="cn('aspect-square h-full w-full', props.class)"
  />
</template>

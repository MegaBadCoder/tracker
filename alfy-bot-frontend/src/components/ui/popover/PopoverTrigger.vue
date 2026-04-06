<script setup lang="ts">
import { PopoverTrigger, type PopoverTriggerProps } from 'reka-ui'

defineProps<PopoverTriggerProps>()
</script>

<template>
  <PopoverTrigger v-bind="$props">
    <slot />
  </PopoverTrigger>
</template>

<script setup lang="ts">
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
</script>

<template>
  <div class="min-h-[100dvh] transition-colors">
    <RouterView />
    <ConfirmDialog />
  </div>
</template>

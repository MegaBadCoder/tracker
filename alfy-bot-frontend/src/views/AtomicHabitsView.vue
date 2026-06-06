<script setup lang="ts">
import { inject } from 'vue'
import { Atom, Hammer } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'

const openSidebar = inject<() => void>('openSidebar')
</script>

<template>
  <AppHeader title="Атомные привычки" :on-menu-click="openSidebar" />

  <PageContainer>
    <div class="py-20 flex flex-col items-center text-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        <Atom class="w-7 h-7" />
      </div>
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <Hammer class="w-4 h-4 text-muted-foreground" />
        Раздел в разработке
      </h2>
      <p class="max-w-sm text-sm text-muted-foreground">
        Атомные привычки скоро появятся. Пока пользуйтесь разделом «Привычки по целям».
      </p>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import GoalCard from '../components/GoalCard.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchGoals } from '../api/goals'
import type { Goal, GoalStatus } from '../types'

type Filter = 'all' | GoalStatus

const goals = ref<Goal[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<Filter>('all')

async function load() {
  loading.value = true
  error.value = null
  try {
    goals.value = await fetchGoals(filter.value === 'all' ? undefined : filter.value)
  }
  catch {
    error.value = 'Не удалось загрузить цели'
    goals.value = []
  }
  finally {
    loading.value = false
  }
}

watch(filter, load, { immediate: true })
</script>

<template>
  <AppHeader title="Мои цели" />

  <main class="max-w-6xl mx-auto px-4 py-6">
    <!-- filters -->
    <Tabs
      :model-value="filter"
      class="mb-6"
      @update:model-value="(v: string | number) => filter = v as Filter"
    >
      <TabsList>
        <TabsTrigger value="all">
          Все
        </TabsTrigger>
        <TabsTrigger value="active">
          Активные
        </TabsTrigger>
        <TabsTrigger value="completed">
          Завершённые
        </TabsTrigger>
        <TabsTrigger value="archived">
          Архив
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- grid -->
    <div v-if="loading" class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Загрузка...</p>
    </div>
    <div v-else-if="error" class="py-20 text-center text-destructive">
      <p class="text-lg">{{ error }}</p>
    </div>
    <div v-else-if="goals.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GoalCard v-for="goal in goals" :key="goal.id" :goal="goal" />
    </div>
    <div v-else class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Нет целей в этой категории</p>
    </div>
  </main>
</template>

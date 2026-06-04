<script setup lang="ts">
import type { Goal, GoalStatus } from '../types'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchGoals } from '../api/goals'
import AppHeader from '../components/AppHeader.vue'
import GoalCard from '../components/GoalCard.vue'

type Filter = 'all' | GoalStatus
type Scope = 'global' | 'regular' | 'all'

const router = useRouter()
const route = useRoute()
const goals = ref<Goal[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const openSidebar = inject<() => void>('openSidebar')
const filter = ref<Filter>('all')

const scope = computed<Scope | undefined>(() => {
  const q = route.query.scope
  return q === 'global' || q === 'regular' || q === 'all' ? q : undefined
})

async function load() {
  loading.value = true
  error.value = null
  try {
    goals.value = await fetchGoals({
      status: filter.value === 'all' ? undefined : filter.value,
      scope: scope.value,
    })
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
watch(() => route.query.scope, load)
</script>

<template>
  <AppHeader title="Мои цели" :on-menu-click="openSidebar" />

  <PageContainer>
    <!-- filters + create -->
    <div class="mb-6 flex flex-row items-center justify-between gap-2">
      <Tabs
        :model-value="filter"
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

      <Button class="flex-shrink-0" @click="router.push({ name: 'goal-create' })">
        <span class="sm:hidden">+</span>
        <span class="hidden sm:inline">+ Создать цель</span>
      </Button>
    </div>

    <!-- grid -->
    <div v-if="loading" class="py-20 text-center text-muted-foreground">
      <p class="text-lg">
        Загрузка...
      </p>
    </div>
    <div v-else-if="error" class="py-20 text-center text-destructive">
      <p class="text-lg">
        {{ error }}
      </p>
    </div>
    <div v-else-if="goals.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GoalCard v-for="goal in goals" :key="goal.id" :goal="goal" />
    </div>
    <div v-else class="py-20 text-center text-muted-foreground">
      <p class="text-lg">
        Нет целей в этой категории
      </p>
    </div>
  </PageContainer>
</template>

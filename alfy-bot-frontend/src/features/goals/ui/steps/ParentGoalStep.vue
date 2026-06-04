<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import type { Goal } from '@/types'
import { onMounted, ref } from 'vue'
import { fetchGoals } from '@/api/goals'
import { Button } from '@/components/ui/button'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectParent', goalId?: number): void
  (e: 'back'): void
}>()

const globals = ref<Goal[]>([])
const loading = ref(true)
const error = ref<string>('')

onMounted(async () => {
  try {
    globals.value = await fetchGoals({ scope: 'global' })
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить глобальные цели'
  }
  finally {
    loading.value = false
  }
})

function pick(goalId: number) {
  emit('selectParent', goalId)
}

function skip() {
  emit('selectParent', undefined)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Привязать к глобальной цели? (необязательно)
    </h2>

    <p v-if="loading" class="text-sm text-muted-foreground">
      Загрузка...
    </p>
    <p v-else-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
    <p v-else-if="globals.length === 0" class="text-sm text-muted-foreground">
      Пока нет глобальных целей — цель будет создана без родителя.
    </p>

    <div v-if="!loading && !error && globals.length > 0" class="flex flex-col gap-2">
      <Button
        v-for="g in globals"
        :key="g.id"
        variant="outline"
        size="lg"
        class="justify-start"
        :data-testid="`parent-option-${g.id}`"
        @click="pick(g.id)"
      >
        <span class="mr-2">🌍</span>
        <span class="truncate">{{ g.goal_name }}</span>
      </Button>
    </div>

    <div class="flex gap-2">
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
      <Button data-testid="parent-skip" @click="skip">
        Без родителя
      </Button>
    </div>
  </div>
</template>

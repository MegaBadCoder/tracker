<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'setPointA', v: boolean): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Зафиксировать точку A? (текущее состояние)
    </h2>

    <div class="flex gap-2">
      <Button @click="emit('setPointA', true)">
        Да
      </Button>
      <Button variant="outline" @click="emit('setPointA', false)">
        Нет
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
    </div>
  </div>
</template>

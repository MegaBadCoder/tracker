<script setup lang="ts">
import { useRouter } from 'vue-router'
import { formatDate } from '../utils/date'
import type { Goal } from '../types'
import { goalAccent, goalBorderClass } from '../utils/goalColor'
import GoalStatusBadge from './GoalStatusBadge.vue'

const props = defineProps<{ goal: Goal }>()
const router = useRouter()

const accent = goalAccent(props.goal.id)
const borderClass = goalBorderClass(props.goal.id)

const questionsLabel = (n: number) =>
  n === 1 ? '1 вопрос' : n < 5 ? `${n} вопроса` : `${n} вопросов`
</script>

<template>
  <div
    :class="[
      'relative bg-card border border-border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md',
      borderClass,
    ]"
    @click="router.push(`/goals/${goal.id}`)"
  >
    <!-- accent stripe -->
    <div
      class="absolute top-0 left-0 w-1 h-full rounded-l-xl"
      :style="{ backgroundColor: accent }"
    />

    <div class="pl-3">
      <!-- title -->
      <h3 class="font-bold text-lg leading-snug mb-2 pr-4 hover:underline">
        {{ goal.goal_name }}
      </h3>

      <!-- status -->
      <GoalStatusBadge :status="goal.status" class="mb-3" />

      <!-- dates -->
      <p class="text-xs text-muted-foreground mb-1">
        {{ formatDate(goal.goal_start) }} → {{ formatDate(goal.goal_end) }}
      </p>

      <!-- questions count -->
      <span class="text-xs text-muted-foreground">
        {{ questionsLabel(goal.questions.length) }}
      </span>
    </div>
  </div>
</template>

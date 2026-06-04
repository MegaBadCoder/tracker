<script setup lang="ts">
import type { Goal } from '../types'
import { useRouter } from 'vue-router'
import { formatDate } from '../utils/date'
import { goalAccent, goalBorderClass } from '../utils/goalColor'
import GoalStatusBadge from './GoalStatusBadge.vue'

const props = defineProps<{ goal: Goal }>()
const router = useRouter()

const accent = goalAccent(props.goal.id)
const borderClass = goalBorderClass(props.goal.id)

function questionsLabel(n: number) {
  return n === 1 ? '1 вопрос' : n < 5 ? `${n} вопроса` : `${n} вопросов`
}

function subGoalsLabel(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  let word: string
  if (mod10 === 1 && mod100 !== 11)
    word = 'подцель'
  else if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
    word = 'подцели'
  else
    word = 'подцелей'
  return `${n} ${word}`
}
</script>

<template>
  <div
    class="relative bg-card border border-border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md" :class="[
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

      <!-- status + global badge -->
      <div class="mb-3 flex items-center gap-2">
        <GoalStatusBadge :status="goal.status" />
        <span
          v-if="goal.is_global"
          class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          Global
        </span>
      </div>

      <!-- dates (only when present) -->
      <p
        v-if="goal.goal_start && goal.goal_end"
        class="text-xs text-muted-foreground mb-1"
      >
        {{ formatDate(goal.goal_start) }} → {{ formatDate(goal.goal_end) }}
      </p>

      <!-- count: sub-goals for global (children_count from list endpoint),
           questions for regular goals. -->
      <span v-if="!goal.is_global" class="text-xs text-muted-foreground">
        {{ questionsLabel(goal.questions.length) }}
      </span>
      <span v-else class="text-xs text-muted-foreground">
        {{ subGoalsLabel(goal.children_count ?? goal.children?.length ?? 0) }}
      </span>
    </div>
  </div>
</template>

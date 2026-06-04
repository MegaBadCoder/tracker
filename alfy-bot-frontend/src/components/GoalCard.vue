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

function goalsLabel(n: number) {
  return n === 1 ? '1 цель' : n < 5 ? `${n} цели` : `${n} целей`
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
          class="inline-flex items-center gap-1 rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-primary"
        >
          🌍 Global
        </span>
      </div>

      <!-- dates (only when present) -->
      <p
        v-if="goal.goal_start && goal.goal_end"
        class="text-xs text-muted-foreground mb-1"
      >
        {{ formatDate(goal.goal_start) }} → {{ formatDate(goal.goal_end) }}
      </p>

      <!-- count: child goals for global (when embedded), questions for regular goals.
           Global goals in list view have no embedded children (only GET /goals/:id embeds),
           and never have questions — so omit the count entirely rather than show "0 вопросов". -->
      <span v-if="!goal.is_global" class="text-xs text-muted-foreground">
        {{ questionsLabel(goal.questions.length) }}
      </span>
      <span v-else-if="goal.children" class="text-xs text-muted-foreground">
        {{ goalsLabel(goal.children.length) }}
      </span>
    </div>
  </div>
</template>

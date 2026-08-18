<template>
  <div class="space-y-1">
    <div class="relative px-1 pt-0.5">
      <Search
        class="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref="searchRef"
        v-model="query"
        class="h-8 pl-8 text-sm"
        placeholder="Найти цель…"
        aria-label="Найти цель"
        @keydown.stop
        @keydown.enter.prevent="toggleFirstVisible"
      />
    </div>

    <Tabs
      :model-value="tab"
      class="gap-1"
      @update:model-value="onTabChange"
    >
      <TabsList class="mx-1 h-8 w-[calc(100%-8px)]">
        <TabsTrigger value="all" class="text-xs">
          Все
        </TabsTrigger>
        <TabsTrigger
          value="selected"
          class="text-xs"
          data-testid="goal-picker-tab-selected"
        >
          Выбрано
          <span
            v-if="modelValue.length"
            class="tabular-nums text-muted-foreground"
          >
            {{ modelValue.length }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" class="mt-0">
        <p v-if="loading" class="px-3 py-2.5 text-sm text-muted-foreground">
          Загрузка…
        </p>

        <p
          v-else-if="allGoals.length === 0"
          class="px-3 py-2.5 text-sm text-muted-foreground"
        >
          Пока нет целей
        </p>

        <div v-else-if="isSearching && flatMatches.length === 0" class="px-3 py-2.5">
          <p class="text-sm">
            Ничего не нашлось
          </p>
          <p class="mt-0.5 text-[12px] text-muted-foreground">
            Попробуйте другое название
          </p>
        </div>

        <template v-else-if="isSearching">
          <button
            v-for="goal in flatMatches"
            :key="goal.id"
            type="button"
            :class="rowClass"
            @click="toggle(goal.id)"
          >
            <Target
              :size="14"
              class="shrink-0"
              :style="{ color: goalAccent(goal.id) }"
            />
            <span class="min-w-0 flex-1 truncate">{{ goal.goal_name }}</span>
            <span
              v-if="parentName(goal)"
              class="max-w-[40%] truncate text-[11px] text-muted-foreground"
            >
              {{ parentName(goal) }}
            </span>
            <Check
              v-if="modelValue.includes(goal.id)"
              :size="14"
              class="shrink-0 text-muted-foreground"
            />
          </button>
        </template>

        <template v-else>
          <template v-if="globalRoots.length > 0">
            <p class="px-3 pb-0.5 pt-1.5 text-[11px] font-medium text-muted-foreground">
              Глобальные
            </p>
            <template v-for="root in globalRoots" :key="root.id">
              <button
                type="button"
                :class="rowClass"
                @click="toggle(root.id)"
              >
                <Target
                  :size="14"
                  class="shrink-0"
                  :style="{ color: goalAccent(root.id) }"
                />
                <span class="min-w-0 flex-1 truncate">{{ root.goal_name }}</span>
                <Check
                  v-if="modelValue.includes(root.id)"
                  :size="14"
                  class="shrink-0 text-muted-foreground"
                />
              </button>
              <button
                v-for="child in childrenOf(root.id)"
                :key="child.id"
                type="button"
                :class="rowClass"
                :style="{ paddingLeft: '28px' }"
                @click="toggle(child.id)"
              >
                <Target
                  :size="14"
                  class="shrink-0"
                  :style="{ color: goalAccent(child.id) }"
                />
                <span class="min-w-0 flex-1 truncate">{{ child.goal_name }}</span>
                <Check
                  v-if="modelValue.includes(child.id)"
                  :size="14"
                  class="shrink-0 text-muted-foreground"
                />
              </button>
            </template>
          </template>

          <template v-if="regularRoots.length > 0">
            <p class="px-3 pb-0.5 pt-1.5 text-[11px] font-medium text-muted-foreground">
              Цели
            </p>
            <template v-for="root in regularRoots" :key="root.id">
              <button
                type="button"
                :class="rowClass"
                @click="toggle(root.id)"
              >
                <Target
                  :size="14"
                  class="shrink-0"
                  :style="{ color: goalAccent(root.id) }"
                />
                <span class="min-w-0 flex-1 truncate">{{ root.goal_name }}</span>
                <Check
                  v-if="modelValue.includes(root.id)"
                  :size="14"
                  class="shrink-0 text-muted-foreground"
                />
              </button>
              <button
                v-for="child in childrenOf(root.id)"
                :key="child.id"
                type="button"
                :class="rowClass"
                :style="{ paddingLeft: '28px' }"
                @click="toggle(child.id)"
              >
                <Target
                  :size="14"
                  class="shrink-0"
                  :style="{ color: goalAccent(child.id) }"
                />
                <span class="min-w-0 flex-1 truncate">{{ child.goal_name }}</span>
                <Check
                  v-if="modelValue.includes(child.id)"
                  :size="14"
                  class="shrink-0 text-muted-foreground"
                />
              </button>
            </template>
          </template>
        </template>
      </TabsContent>

      <TabsContent value="selected" class="mt-0">
        <p
          v-if="selectedGoals.length === 0"
          class="px-3 py-2.5 text-sm text-muted-foreground"
        >
          Ничего не выбрано
        </p>
        <div v-else-if="filteredSelected.length === 0" class="px-3 py-2.5">
          <p class="text-sm">
            Ничего не нашлось
          </p>
          <p class="mt-0.5 text-[12px] text-muted-foreground">
            Попробуйте другое название
          </p>
        </div>
        <template v-else>
          <button
            v-for="goal in filteredSelected"
            :key="`sel-${goal.id}`"
            type="button"
            :class="rowClass"
            @click="toggle(goal.id)"
          >
            <Target
              :size="14"
              class="shrink-0"
              :style="{ color: goalAccent(goal.id) }"
            />
            <span class="min-w-0 flex-1 truncate">{{ goal.goal_name }}</span>
            <Check :size="14" class="shrink-0 text-muted-foreground" />
          </button>
        </template>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import type { Goal } from '@/types'
import { computed, nextTick, onMounted, ref } from 'vue'
import { Check, Search, Target } from 'lucide-vue-next'
import { fetchGoals } from '@/api/goals'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { goalAccent } from '@/utils/goalColor'

const ROW_CLASS = 'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60'

const props = defineProps<{
  modelValue: number[]
  goals?: Goal[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const query = ref('')
const tab = ref<'all' | 'selected'>('all')
const fetched = ref<Goal[]>([])
const fetching = ref(!props.goals)
const searchRef = ref<{ $el?: HTMLInputElement } | null>(null)
const rowClass = ROW_CLASS

onMounted(async () => {
  if (props.goals)
    return
  try {
    fetched.value = (await fetchGoals()).filter(g => g.status !== 'deleted')
  }
  finally {
    fetching.value = false
  }
})

const loading = computed(() => props.loading ?? fetching.value)
const allGoals = computed(() => props.goals ?? fetched.value)
const byId = computed(() => new Map(allGoals.value.map(g => [g.id, g])))
const isSearching = computed(() => query.value.trim().length > 0)
const needle = computed(() => query.value.trim().toLowerCase())

function matches(goal: Goal): boolean {
  if (!needle.value)
    return true
  if (goal.goal_name.toLowerCase().includes(needle.value))
    return true
  const parent = goal.parent_goal_id ? byId.value.get(goal.parent_goal_id) : undefined
  return !!parent?.goal_name.toLowerCase().includes(needle.value)
}

const visible = computed(() => allGoals.value.filter(matches))

const selectedGoals = computed(() =>
  props.modelValue
    .map(id => byId.value.get(id))
    .filter((g): g is Goal => !!g),
)

const filteredSelected = computed(() => selectedGoals.value.filter(matches))

const globalRoots = computed(() =>
  visible.value.filter(g => g.is_global).sort(byName),
)

const regularRoots = computed(() =>
  visible.value
    .filter((g) => {
      if (g.is_global)
        return false
      if (!g.parent_goal_id)
        return true
      return !byId.value.has(g.parent_goal_id)
    })
    .sort(byName),
)

function byName(a: Goal, b: Goal) {
  return a.goal_name.localeCompare(b.goal_name, 'ru')
}

function childrenOf(parentId: number): Goal[] {
  return visible.value
    .filter(g => g.parent_goal_id === parentId)
    .sort(byName)
}

function parentName(goal: Goal): string | undefined {
  if (!goal.parent_goal_id)
    return undefined
  return byId.value.get(goal.parent_goal_id)?.goal_name
}

const flatMatches = computed(() => {
  const selected = new Set(props.modelValue)
  return [...visible.value].sort((a, b) => {
    const as = selected.has(a.id) ? 0 : 1
    const bs = selected.has(b.id) ? 0 : 1
    if (as !== bs)
      return as - bs
    const aStart = a.goal_name.toLowerCase().startsWith(needle.value) ? 0 : 1
    const bStart = b.goal_name.toLowerCase().startsWith(needle.value) ? 0 : 1
    if (aStart !== bStart)
      return aStart - bStart
    return a.goal_name.localeCompare(b.goal_name, 'ru')
  })
})

function toggle(id: number) {
  const has = props.modelValue.includes(id)
  emit(
    'update:modelValue',
    has ? props.modelValue.filter(x => x !== id) : [...props.modelValue, id],
  )
}

function onTabChange(value: string | number) {
  tab.value = value === 'selected' ? 'selected' : 'all'
}

function toggleFirstVisible() {
  const first = tab.value === 'selected'
    ? filteredSelected.value[0]
    : isSearching.value
      ? flatMatches.value[0]
      : visible.value[0]
  if (first)
    toggle(first.id)
}

function focusSearch() {
  nextTick(() => {
    const el = searchRef.value?.$el
    if (el instanceof HTMLInputElement)
      el.focus()
  })
}

function resetQuery() {
  query.value = ''
  tab.value = 'all'
}

defineExpose({ focusSearch, resetQuery })
</script>

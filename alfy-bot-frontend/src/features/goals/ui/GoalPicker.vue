<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :class="[
          'w-full px-4 py-2.5 transition-colors border-b border-border/40 text-left',
          !disabled && 'cursor-pointer hover:bg-muted/50',
        ]"
        :disabled="disabled"
      >
        <div class="flex items-center gap-2 mb-1">
          <Target :size="13" class="text-muted-foreground/60" />
          <span class="text-[11px] text-muted-foreground/60 font-medium">Цель</span>
        </div>
        <div class="text-[13px] truncate" :class="modelValue.length === 0 && 'text-muted-foreground/40'">
          {{ triggerLabel }}
        </div>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent @open-auto-focus.prevent>
      <GoalPickerContent
        ref="contentRef"
        :model-value="modelValue"
        :goals="goals"
        :loading="loading"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import type { Goal } from '@/types'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Target } from 'lucide-vue-next'
import { fetchGoals } from '@/api/goals'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import GoalPickerContent from './GoalPickerContent.vue'

const props = defineProps<{
  modelValue: number[]
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const open = ref(false)
const goals = ref<Goal[]>([])
const loading = ref(true)
const contentRef = ref<{ focusSearch: () => void, resetQuery: () => void } | null>(null)

onMounted(async () => {
  try {
    goals.value = (await fetchGoals()).filter(g => g.status !== 'deleted')
  }
  finally {
    loading.value = false
  }
})

watch(open, async (isOpen) => {
  if (!isOpen)
    return
  await nextTick()
  contentRef.value?.resetQuery()
  contentRef.value?.focusSearch()
})

const triggerLabel = computed(() => {
  const ids = props.modelValue
  if (ids.length === 0)
    return 'Не привязано'
  const names = ids
    .map(id => goals.value.find(g => g.id === id)?.goal_name)
    .filter((n): n is string => !!n)
  if (names.length === 0)
    return ids.length === 1 ? 'Цель' : `${ids.length} цели`
  if (names.length === 1)
    return names[0]!
  if (names.length === 2)
    return `${names[0]}, ${names[1]}`
  return `${names[0]}, ${names[1]} +${names.length - 2}`
})
</script>

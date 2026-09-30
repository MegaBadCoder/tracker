<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { cn } from '@/lib/utils'

/**
 * Вкладки agile-проекта: «Доска», «Бэклог» и «Релизы». Активная вкладка определяется
 * по имени текущего маршрута. Тип проекта не проверяется — вызывающий
 * рендерит компонент только для agile-проекта.
 */
const props = defineProps<{
  /** Id проекта, в маршруты которого ведут вкладки. */
  projectId: string
}>()

const route = useRoute()

const tabs = computed(() => [
  { label: 'Доска', routeName: 'tasks-project' },
  { label: 'Бэклог', routeName: 'tasks-project-backlog' },
  { label: 'Релизы', routeName: 'tasks-project-releases' },
].map(tab => ({
  ...tab,
  to: { name: tab.routeName, params: { projectId: props.projectId } },
  active: route.name === tab.routeName,
})))
</script>

<template>
  <nav class="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center rounded-lg p-[3px]" aria-label="Разделы проекта">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.routeName"
      :to="tab.to"
      :aria-current="tab.active ? 'page' : undefined"
      :data-active="tab.active"
      :class="cn(
        'inline-flex h-full items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] text-muted-foreground hover:text-foreground',
        tab.active && 'bg-background text-foreground shadow-sm',
      )"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

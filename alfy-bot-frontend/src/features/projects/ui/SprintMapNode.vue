<script setup lang="ts">
import type { SprintMapNode } from '../lib/sprint-map'
import { ChevronDown, ChevronRight, Crosshair, ExternalLink, GitBranch, LockKeyhole, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { taskLinkPath } from '@/features/tasks/lib/task-link'
import { pluralRu } from '@/lib/plural'
import { groupLinkPath } from '../lib/group-link'

const props = withDefaults(defineProps<{ node: SprintMapNode, projectId: string, collapsed: boolean, readonly: boolean, selected: boolean, waitingCount?: number, dependenciesSelected?: boolean }>(), { waitingCount: 0, dependenciesSelected: false })
const emit = defineEmits<{ toggle: [], open: [], add: [], focus: [], dependencies: [] }>()
const labels = { sprint: 'Спринт', epic: 'Эпик', story: 'История', task: 'Задача', ungrouped: 'Без эпика' }
const childLabels = { sprint: 'Добавить эпик', epic: 'Добавить историю', story: 'Добавить задачу', task: '', ungrouped: '' }
const canOpen = computed(() => ['epic', 'story', 'task'].includes(props.node.kind))
const href = computed(() => {
  if (!props.node.sourceId)
    return null
  if (props.node.kind === 'task')
    return taskLinkPath(props.node.sourceId)
  if (props.node.kind === 'story' || props.node.kind === 'epic')
    return groupLinkPath(props.projectId, props.node.sourceId)
  return null
})
function descendantCount(node: SprintMapNode): number {
  return node.children.reduce((sum, child) => sum + 1 + descendantCount(child), 0)
}
const details = computed(() => [
  props.collapsed ? `Скрыто: ${descendantCount(props.node)}` : '',
  props.node.outsideCount ? `Вне спринта: ${props.node.outsideCount}` : '',
  ...props.node.releases.map(release => `${release.status === 'released' ? 'Выпущен' : 'Запланирован'}: ${release.name}`),
].filter(Boolean).join(' · '))
</script>

<template>
  <article
    :data-map-node="node.key"
    :aria-label="`${labels[node.kind]}: ${node.title}`"
    tabindex="-1"
    class="map-node relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card px-3 py-2.5 text-card-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :class="[selected ? 'border-primary ring-2 ring-primary/20' : 'border-border', node.kind === 'sprint' ? 'border-primary/40 bg-primary/5' : '']"
  >
    <div class="flex h-5 shrink-0 items-center gap-1.5">
      <span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{{ labels[node.kind] }}</span>
      <span v-if="node.kind === 'task' && waitingCount" class="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" aria-live="polite">Ждёт {{ waitingCount }} {{ pluralRu(waitingCount, ['задачу', 'задачи', 'задач']) }}</span>
      <span v-if="node.blockedReason" :title="node.blockedReason" class="inline-flex min-w-0 items-center gap-1 text-[10px] text-destructive">
        <LockKeyhole class="size-3" />Блокировка
      </span>
      <Button
        v-if="node.children.length"
        variant="ghost" size="icon-sm" class="ml-auto size-6"
        :aria-label="`${collapsed ? 'Развернуть' : 'Свернуть'} ${node.title}`"
        :aria-expanded="!collapsed" @click="emit('toggle')"
      >
        <ChevronRight v-if="collapsed" class="size-3.5" /><ChevronDown v-else class="size-3.5" />
      </Button>
    </div>
    <button
      v-if="canOpen" type="button" class="my-1 h-9 shrink-0 text-left text-sm leading-[18px] font-medium outline-none hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
      :title="node.title" :aria-label="`Быстрый просмотр: ${node.title}`" @click="emit('open')"
    >
      <span class="line-clamp-2 wrap-anywhere">{{ node.title }}</span>
    </button>
    <div v-else class="my-1 h-9 shrink-0 text-sm leading-[18px] font-medium" :title="node.title">
      <span class="line-clamp-2 wrap-anywhere">{{ node.title }}</span>
    </div>
    <div class="flex h-4 shrink-0 items-center gap-1.5 text-[11px]" :title="node.statusLabel">
      <span class="size-1.5 shrink-0 rounded-full bg-muted-foreground" :style="node.statusColor ? { backgroundColor: node.statusColor } : undefined" />
      <span class="truncate">{{ node.statusLabel }}</span>
    </div>
    <div class="mt-1 h-4 shrink-0 truncate text-[10px] text-muted-foreground" :title="details">
      {{ details }}
    </div>
    <div class="mt-auto flex h-6 shrink-0 items-center gap-0.5">
      <span class="mr-auto text-[11px] tabular-nums" :aria-label="`Выполнено задач: ${node.done} из ${node.total}`">
        <template v-if="node.total"><strong class="font-semibold">{{ node.done }}</strong><span class="text-muted-foreground"> / {{ node.total }} задач</span></template>
        <span v-else class="text-muted-foreground">Нет задач</span>
      </span>
      <Button v-if="node.kind === 'task'" variant="ghost" size="icon-sm" class="size-6" :aria-label="`Связи: ${node.title}`" :aria-pressed="dependenciesSelected" @click="emit('dependencies')">
        <GitBranch class="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" class="size-6" :aria-label="`В центре: ${node.title}`" @click="emit('focus')">
        <Crosshair class="size-3.5" />
      </Button>
      <a v-if="href" :href="href" class="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" :aria-label="`Открыть страницу: ${node.title}`" :title="`Открыть страницу: ${node.title}`"><ExternalLink class="size-3.5" /></a>
      <Button v-if="!readonly && childLabels[node.kind]" variant="ghost" size="icon-sm" class="size-6" :aria-label="`${childLabels[node.kind]}: ${node.title}`" @click="emit('add')">
        <Plus class="size-3.5" />
      </Button>
    </div>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-muted">
      <div class="h-full bg-primary/70" :style="{ width: `${node.total ? node.done / node.total * 100 : 0}%` }" />
    </div>
  </article>
</template>

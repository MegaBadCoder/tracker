<script setup lang="ts">
import type { SprintMapNode } from '../lib/sprint-map'
import type { TaskDependencyEdge } from '@/features/tasks/model/task-dependencies'
import type { Task } from '@/features/tasks/model/types'
import { useScrollLock, useStorage } from '@vueuse/core'
import { ChevronsLeftRight, GitBranch, Maximize, Maximize2, Minimize2, Minus, Plus, Search, X } from 'lucide-vue-next'
import { FocusScope } from 'reka-ui'
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { flattenSprintMap } from '../lib/sprint-map'
import { deriveSprintMapDependencies } from '../lib/sprint-map-dependencies'
import { layoutSprintMap } from '../lib/sprint-map-layout'
import { useSprintMapViewport } from '../lib/use-sprint-map-viewport'
import SprintMapDependencies from './SprintMapDependencies.vue'
import SprintMapNodeCard from './SprintMapNode.vue'

const props = withDefaults(defineProps<{ root: SprintMapNode, projectId: string, readonly: boolean, tasks?: Task[], dependencies?: TaskDependencyEdge[] }>(), { tasks: () => [], dependencies: () => [] })
const emit = defineEmits<{ openNode: [node: SprintMapNode], addChild: [node: SprintMapNode] }>()
const surface = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
const scrollLocked = useScrollLock(document.documentElement)
const query = ref('')
const selected = ref<string | null>(null)
const dependencySelection = ref<string | null>(null)
const showAllDependencies = ref(false)
const dependencyArrowId = `dependency-arrow-${useId()}`
const stored = useStorage<Record<string, string[]>>('alfy-sprint-map-collapsed', {}, undefined, { flush: 'sync' })
const scope = computed(() => `${props.projectId}/${props.root.key}`)
const collapsed = computed(() => new Set(Array.isArray(stored.value?.[scope.value]) ? stored.value[scope.value] : []))
const layout = computed(() => layoutSprintMap(props.root, collapsed.value))
const allNodes = computed(() => flattenSprintMap(props.root))
const matches = computed(() => query.value.trim() ? allNodes.value.filter(node => node.title.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())) : [])
const dependencyGraph = computed(() => deriveSprintMapDependencies({ root: props.root, visibleNodes: layout.value.nodes, tasks: props.tasks, dependencies: props.dependencies, selectedTaskId: dependencySelection.value, showAll: showAllDependencies.value }))
const dependencyTitle = computed(() => props.tasks.find(task => task.id === dependencySelection.value)?.title ?? null)
const viewport = useSprintMapViewport(surface)
const { scale, minScale, dragging, transform } = viewport
const percentage = computed(() => Math.round(scale.value * 100))

async function setFullscreen(value: boolean) {
  fullscreen.value = value
  scrollLocked.value = value
  await nextTick()
  fit()
  container.value?.querySelector<HTMLElement>('[data-fullscreen-toggle]')?.focus({ preventScroll: true })
}

function onEscape(event: KeyboardEvent) {
  if (!fullscreen.value || event.defaultPrevented)
    return
  event.preventDefault()
  void setFullscreen(false)
}

function saveCollapsed(keys: Set<string>) {
  stored.value = { ...stored.value, [scope.value]: [...keys] }
}

async function toggle(node: SprintMapNode) {
  const before = layout.value.nodes.find(item => item.node.key === node.key)
  const next = new Set(collapsed.value)
  if (next.has(node.key))
    next.delete(node.key)
  else
    next.add(node.key)
  saveCollapsed(next)
  await nextTick()
  const after = layout.value.nodes.find(item => item.node.key === node.key)
  if (before && after) {
    viewport.x.value += (before.x - after.x) * scale.value
    viewport.y.value += (before.y - after.y) * scale.value
  }
}

function focusNode(key: string, readable = true) {
  const item = layout.value.nodes.find(item => item.node.key === key)
  if (!item)
    return
  if (readable && scale.value < 0.8)
    viewport.zoom(0.8)
  viewport.focus({ x: item.x + item.width / 2, y: item.y + item.height / 2 })
  selected.value = key
}

function ancestorPath(node: SprintMapNode, key: string): string[] | null {
  if (node.key === key)
    return []
  for (const child of node.children) {
    const path = ancestorPath(child, key)
    if (path)
      return [node.key, ...path]
  }
  return null
}

async function reveal(node: SprintMapNode) {
  const next = new Set(collapsed.value)
  for (const key of ancestorPath(props.root, node.key) ?? [])
    next.delete(key)
  saveCollapsed(next)
  query.value = ''
  await nextTick()
  focusNode(node.key)
  const target = Array.from(surface.value?.querySelectorAll<HTMLElement>('[data-map-node]') ?? []).find(element => element.dataset.mapNode === node.key)
  target?.focus({ preventScroll: true })
}

function selectDependencies(node: SprintMapNode) {
  dependencySelection.value = node.sourceId
  showAllDependencies.value = false
  selected.value = node.key
}

function revealDependency(taskId: string) {
  const node = allNodes.value.find(item => item.kind === 'task' && item.sourceId === taskId)
  if (node)
    void reveal(node)
}

function closeDependencies() {
  dependencySelection.value = null
  showAllDependencies.value = false
}

function fit() {
  viewport.fit(layout.value)
}

function expandAll() {
  saveCollapsed(new Set())
  nextTick(fit)
}

async function add(node: SprintMapNode) {
  if (collapsed.value.has(node.key))
    await toggle(node)
  emit('addChild', node)
}

function initialize() {
  const root = layout.value.nodes.find(item => item.node.key === props.root.key)
  if (root)
    viewport.initialize(layout.value, { x: root.x + root.width / 2, y: root.y + root.height / 2 })
}

watch(scope, async () => {
  query.value = ''
  selected.value = null
  closeDependencies()
  await nextTick()
  initialize()
})
onMounted(initialize)
</script>

<template>
  <Teleport to="body" :disabled="!fullscreen">
    <FocusScope as-child :trapped="fullscreen" :loop="fullscreen" @mount-auto-focus.prevent @unmount-auto-focus.prevent>
      <section
        ref="container" class="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-background"
        :class="fullscreen ? 'fixed inset-0 z-40 h-dvh w-full' : 'rounded-xl border'"
        :role="fullscreen ? 'dialog' : 'region'" :aria-modal="fullscreen || undefined"
        aria-label="Турнирная карта спринта" @keydown.esc="onEscape"
      >
        <div class="relative z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card p-2 sm:px-3">
          <div class="relative min-w-40 flex-1 sm:max-w-80">
            <Search class="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input v-model="query" aria-label="Найти на карте" placeholder="Найти на карте…" class="h-9 pr-8 pl-8" @keydown.enter.prevent="matches[0] && reveal(matches[0])" @keydown.esc="query = ''" />
            <Button v-if="query" variant="ghost" size="icon-sm" class="absolute top-0.5 right-0.5" aria-label="Очистить поиск" @click="query = ''">
              <X class="size-3.5" />
            </Button>
            <div v-if="query.trim()" class="absolute top-full right-0 left-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg" aria-label="Результаты поиска">
              <p class="px-2 py-1.5 text-xs text-muted-foreground" role="status">
                {{ matches.length ? `Найдено: ${matches.length}` : 'Ничего не найдено' }}
              </p>
              <button v-for="node in matches.slice(0, 20)" :key="node.key" type="button" class="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" @click="reveal(node)">
                <span class="line-clamp-2 wrap-anywhere">{{ node.title }}</span>
                <span class="text-xs text-muted-foreground">{{ node.statusLabel }}</span>
              </button>
              <p v-if="matches.length > 20" class="px-2 py-1.5 text-xs text-muted-foreground">
                Уточните запрос, чтобы увидеть остальные.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Уменьшить масштаб" :disabled="scale <= minScale" @click="viewport.zoom(scale / 1.2)">
              <Minus />
            </Button>
            <button type="button" class="w-11 rounded px-1 py-1.5 text-center text-xs tabular-nums hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Масштаб 100 процентов" @click="viewport.zoom(1)">
              {{ percentage }}%
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Увеличить масштаб" :disabled="scale >= 1.75" @click="viewport.zoom(scale * 1.2)">
              <Plus />
            </Button>
          </div>
          <Button variant="outline" size="sm" @click="fit">
            <Maximize /><span>Вся карта</span>
          </Button>
          <Button variant="ghost" size="sm" :disabled="!collapsed.size" @click="expandAll">
            <ChevronsLeftRight /><span>Раскрыть всё</span>
          </Button>
          <Button :variant="showAllDependencies ? 'secondary' : 'ghost'" size="sm" aria-label="Все связи задач" :aria-pressed="showAllDependencies" @click="showAllDependencies = !showAllDependencies">
            <GitBranch /><span>Все связи</span>
          </Button>
          <Button variant="outline" size="sm" class="ml-auto" data-fullscreen-toggle :aria-label="fullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть карту на весь экран'" :aria-pressed="fullscreen" @click="setFullscreen(!fullscreen)">
            <Minimize2 v-if="fullscreen" /><Maximize2 v-else />
            <span>{{ fullscreen ? 'Свернуть' : 'На весь экран' }}</span>
          </Button>
        </div>
        <div
          ref="surface" class="map-surface relative flex-1 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          :class="[dragging ? 'cursor-grabbing' : 'cursor-grab', fullscreen ? 'min-h-0' : 'min-h-[420px]']" tabindex="0" role="region" aria-label="Полотно: стрелки для перемещения, плюс и минус для масштаба"
          @pointerdown="viewport.onPointerDown" @pointermove="viewport.onPointerMove" @pointerup="viewport.onPointerUp" @pointercancel="viewport.onPointerUp" @lostpointercapture="viewport.onPointerUp"
          @wheel.prevent="viewport.onWheel" @keydown="viewport.onKeyDown"
        >
          <div class="absolute top-0 left-0 origin-top-left" :style="{ width: `${layout.width}px`, height: `${layout.height}px`, transform }" data-testid="map-plane">
            <svg class="pointer-events-none absolute inset-0 overflow-visible" :width="layout.width" :height="layout.height" aria-hidden="true">
              <path v-for="edge in layout.edges" :key="`${edge.from}-${edge.to}`" :d="edge.path" fill="none" class="stroke-muted-foreground/35" stroke-width="1.5" />
            </svg>
            <svg class="pointer-events-none absolute inset-0 overflow-visible" :width="layout.width" :height="layout.height" aria-hidden="true">
              <defs>
                <marker :id="dependencyArrowId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
                </marker>
              </defs>
              <template v-for="link in dependencyGraph.links" :key="`${link.dependencyId}-${link.taskId}`">
                <path v-if="link.path" :d="link.path" fill="none" :class="link.completed ? 'stroke-muted-foreground/60' : 'stroke-primary'" stroke-width="2" stroke-dasharray="6 5" :marker-end="`url(#${dependencyArrowId})`" :data-dependency-edge="`${link.dependencyId}-${link.taskId}`" :data-completed="link.completed" />
              </template>
            </svg>
            <div v-for="item in layout.nodes" :key="item.node.key" class="absolute cursor-default" :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px`, height: `${item.height}px` }">
              <SprintMapNodeCard :node="item.node" :project-id="projectId" :readonly="readonly" :collapsed="collapsed.has(item.node.key)" :selected="selected === item.node.key" :waiting-count="dependencyGraph.waiting.get(item.node.sourceId ?? '') ?? 0" :dependencies-selected="dependencySelection === item.node.sourceId" @dependencies="selectDependencies(item.node)" @toggle="toggle(item.node)" @focus="focusNode(item.node.key)" @open="emit('openNode', item.node)" @add="add(item.node)" />
            </div>
          </div>
        </div>
        <SprintMapDependencies v-if="dependencySelection || showAllDependencies" :links="dependencyGraph.links" :selected-title="dependencyTitle" :project-id="projectId" :show-all="showAllDependencies" @reveal="revealDependency" @close="closeDependencies" />
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
          <span>Задачи → истории → эпики → спринт</span>
          <span class="hidden sm:inline">Тяните фон · Ctrl / ⌘ + прокрутка — масштаб</span>
          <span v-if="readonly">Спринт закрыт · просмотр</span>
        </div>
      </section>
    </FocusScope>
  </Teleport>
</template>

<style scoped>
.map-surface {
  touch-action: none;
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>

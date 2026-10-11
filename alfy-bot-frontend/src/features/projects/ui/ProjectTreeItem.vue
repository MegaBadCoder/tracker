<script setup lang="ts">
import type { ProjectTreeNode } from '../model/types'
import {
  ArrowUp,
  CornerUpLeft,
  ArrowDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Book,
  Briefcase,
  Camera,
  Code,
  Coffee,
  FolderOpen,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  MoreHorizontal,
  Music,
  Palette,
  Pencil,
  Plane,
  Rocket,
  Shield,
  ShoppingCart,
  Star,
  Stethoscope,
  Target,
  Users,
  Wrench,
  Zap,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PROJECT_INDENT } from '../lib/project-tree-drag'
import { useProjectStore } from '../model/project-store'
import { useDropTarget } from '@/features/tasks/lib/dnd/use-drop-target'

const props = defineProps<{
  node: ProjectTreeNode
  depth: number
  canMoveUp: boolean
  canMoveDown: boolean
}>()

defineEmits<{
  edit: [node: ProjectTreeNode]
  createChild: [node: ProjectTreeNode]
  delete: [node: ProjectTreeNode]
  dragStart: [event: PointerEvent]
  outdent: []
  move: [offset: number]
}>()

const store = useProjectStore()
const expanded = computed(() => !store.collapsedIds.has(props.node.id))

const iconComponents: Record<string, any> = {
  FolderOpen,
  Star,
  Briefcase,
  Home,
  Book,
  Code,
  Zap,
  Heart,
  Target,
  Rocket,
  Globe,
  Music,
  Camera,
  Coffee,
  Lightbulb,
  Shield,
  Users,
  Palette,
  Gamepad2,
  GraduationCap,
  Stethoscope,
  Wrench,
  ShoppingCart,
  Plane,
}

const nodeIcon = computed(() => {
  if (props.node.icon && iconComponents[props.node.icon]) {
    return iconComponents[props.node.icon]
  }
  return FolderOpen
})

const linkRef = ref<InstanceType<typeof RouterLink> | null>(null)
const linkEl = computed<HTMLElement | null>(() => (linkRef.value as any)?.$el ?? null)

const { isHovered } = useDropTarget({
  id: `project:${props.node.id}`,
  kind: 'project',
  el: linkEl,
  projectId: props.node.id,
})

const route = useRoute()
const isActive = computed(() => route.params.projectId === props.node.id)
</script>

<template>
  <div>
    <div class="group/row relative flex min-w-0 items-center" :style="{ paddingLeft: `${depth * PROJECT_INDENT}px` }">
      <span class="project-drag-handle shrink-0 cursor-grab touch-none p-1 text-sidebar-foreground/40" aria-hidden="true" @pointerdown="$emit('dragStart', $event)" @touchstart.stop @dragstart.prevent>
        <GripVertical :size="12" />
      </span>
      <button
        v-if="node.children.length"
        class="shrink-0 rounded p-1 hover:bg-sidebar-accent"
        :aria-label="`${expanded ? 'Свернуть' : 'Развернуть'} ${node.title}`"
        :aria-expanded="expanded"
        @click="store.toggleExpanded(node.id)"
      >
        <ChevronRight :size="12" :class="expanded ? 'rotate-90' : ''" />
      </button>
      <span v-else class="w-5 shrink-0" />
      <RouterLink
        ref="linkRef"
        :to="`/tasks/project/${node.id}`"
        data-drop-kind="project"
        :data-project-id="node.id"
        class="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 pr-8 rounded-md text-sm font-medium transition-colors"
        :class="[
          isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
          isHovered ? 'bg-accent ring-2 ring-primary' : '',
        ]"
      >
        <component
          :is="nodeIcon"
          :size="14"
          :style="node.color ? { color: node.color } : undefined"
          class="shrink-0"
        />
        <span class="truncate flex-1">{{ node.title }}</span>
      </RouterLink>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            :aria-label="`Действия проекта ${node.title}`"
            :disabled="store.treeBusy"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all opacity-60 group-hover/row:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 cursor-pointer"
          >
            <MoreHorizontal :size="14" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="$emit('createChild', node)">
            <Plus :size="14" class="mr-2" />
            Создать подпроект
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('edit', node)">
            <Pencil :size="14" class="mr-2" />
            Изменить
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canMoveUp" @click="$emit('move', -1)">
            <ArrowUp :size="14" class="mr-2" />
            Переместить выше
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canMoveDown" @click="$emit('move', 1)">
            <ArrowDown :size="14" class="mr-2" />
            Переместить ниже
          </DropdownMenuItem>
          <DropdownMenuItem v-if="node.parentId" @click="$emit('outdent')">
            <CornerUpLeft :size="14" class="mr-2" />
            На уровень выше
          </DropdownMenuItem>
          <DropdownMenuItem class="text-destructive" @click="$emit('delete', node)">
            <Trash2 :size="14" class="mr-2" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { ProjectTreeNode } from '../model/types'
import {
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
import { useDropTarget } from '@/features/tasks/lib/dnd/use-drop-target'

const props = defineProps<{
  node: ProjectTreeNode
  depth: number
}>()

defineEmits<{
  edit: [node: ProjectTreeNode]
}>()

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
    <div class="group/row relative">
      <RouterLink
        ref="linkRef"
        :to="`/tasks/project/${node.id}`"
        data-drop-kind="project"
        :data-project-id="node.id"
        class="flex items-center gap-3 px-3 py-2 pr-8 rounded-md text-sm font-medium transition-colors"
        :style="{ paddingLeft: `${12 + depth * 16}px` }"
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

      <!-- Actions menu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all opacity-0 group-hover/row:opacity-100 cursor-pointer"
          >
            <MoreHorizontal :size="14" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="$emit('edit', node)">
            <Pencil :size="14" class="mr-2" />
            Изменить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <ProjectTreeItem
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      @edit="$emit('edit', $event)"
    />
  </div>
</template>

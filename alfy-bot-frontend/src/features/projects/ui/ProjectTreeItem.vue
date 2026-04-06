<template>
  <div>
    <div class="group/row relative">
      <RouterLink
        :to="`/tasks/project/${node.id}`"
        class="flex items-center gap-2 px-3 py-1.5 pr-8 rounded-md text-sm transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground"
        :style="{ paddingLeft: `${12 + depth * 16}px` }"
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
        <DropdownMenuContent align="end" class="w-36">
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

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  FolderOpen, Star, Briefcase, Home, Book, Code, Zap, Heart,
  Target, Rocket, Globe, Music, Camera, Coffee, Lightbulb, Shield,
  Users, Palette, Gamepad2, GraduationCap, Stethoscope, Wrench,
  ShoppingCart, Plane, MoreHorizontal, Pencil,
} from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { ProjectTreeNode } from '../model/types'

const props = defineProps<{
  node: ProjectTreeNode
  depth: number
}>()

defineEmits<{
  edit: [node: ProjectTreeNode]
}>()

const iconComponents: Record<string, any> = {
  FolderOpen, Star, Briefcase, Home, Book, Code, Zap, Heart,
  Target, Rocket, Globe, Music, Camera, Coffee, Lightbulb, Shield,
  Users, Palette, Gamepad2, GraduationCap, Stethoscope, Wrench,
  ShoppingCart, Plane,
}

const nodeIcon = computed(() => {
  if (props.node.icon && iconComponents[props.node.icon]) {
    return iconComponents[props.node.icon]
  }
  return FolderOpen
})
</script>

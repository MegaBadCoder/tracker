<template>
  <div class="flex items-center gap-2 px-3 py-2 min-h-[40px]">
    <GripVertical
      v-if="column"
      :size="14"
      class="shrink-0 text-muted-foreground/40 cursor-grab column-drag-handle"
    />
    <div
      v-if="column?.color"
      class="w-2.5 h-2.5 rounded-full shrink-0"
      :style="{ backgroundColor: column.color }"
    />
    <template v-if="isRenaming">
      <Input
        ref="renameInputRef"
        v-model="renameTitle"
        class="text-sm h-7 flex-1"
        autofocus
        @keydown.enter="commitRename"
        @keydown.escape="cancelRename"
        @blur="commitRename"
      />
    </template>
    <template v-else>
      <span class="text-sm font-medium truncate flex-1">
        {{ column?.title ?? 'Без раздела' }}
      </span>
    </template>
    <span class="text-xs text-muted-foreground shrink-0">{{ taskCount }}</span>
    <DropdownMenu v-if="column">
      <DropdownMenuTrigger as-child>
        <button
          class="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          <MoreHorizontal :size="14" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @click="startRename">
          <Pencil :size="14" class="mr-2" />
          Переименовать
        </DropdownMenuItem>
        <DropdownMenuItem
          class="text-destructive focus:text-destructive"
          @click="$emit('delete')"
        >
          <Trash2 :size="14" class="mr-2" />
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { ProjectColumn } from '../model/types'

defineProps<{
  column: ProjectColumn | null
  taskCount: number
}>()

const emit = defineEmits<{
  rename: [title: string]
  delete: []
}>()

const isRenaming = ref(false)
const renameTitle = ref('')
const renameInputRef = ref<InstanceType<typeof Input> | null>(null)

function startRename() {
  renameTitle.value = ''
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.$el?.focus()
  })
}

function commitRename() {
  if (renameTitle.value.trim()) {
    emit('rename', renameTitle.value.trim())
  }
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}
</script>

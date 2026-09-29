<script setup lang="ts">
import type { BoardGroup } from '../model/types'
import { Ellipsis, Palette, Pencil, Plus, SquareArrowOutUpRight, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PROJECT_COLOR_PALETTE } from '../model/project-color-palette'

/**
 * Меню действий эпика/истории на agile-доске. «Цвет» и «Добавить историю»
 * доступны только эпику — у истории нет ни своего цвета, ни вложенных историй.
 */
const props = defineProps<{
  group: BoardGroup
}>()

defineEmits<{
  open: []
  rename: []
  setColor: [color: string | null]
  addStory: []
  toggleDone: []
  delete: []
}>()

const isEpic = computed(() => props.group.type === 'epic')
const triggerLabel = computed(() => (isEpic.value ? 'Действия с эпиком' : 'Действия с историей'))
const toggleDoneLabel = computed(() => (props.group.status === 'done' ? 'Открыть' : 'Закрыть'))
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" :aria-label="triggerLabel">
        <Ellipsis :size="16" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="$emit('open')">
        <SquareArrowOutUpRight :size="14" class="mr-2" />
        Открыть карточку
      </DropdownMenuItem>
      <DropdownMenuItem @click="$emit('rename')">
        <Pencil :size="14" class="mr-2" />
        Переименовать
      </DropdownMenuItem>
      <DropdownMenuSub v-if="isEpic">
        <DropdownMenuSubTrigger>
          <Palette :size="14" class="mr-2" />
          Цвет
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            v-for="color in PROJECT_COLOR_PALETTE"
            :key="color"
            @click="$emit('setColor', color)"
          >
            <span class="w-3 h-3 rounded-full mr-2 shrink-0" :style="{ backgroundColor: color }" />
            {{ color }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('setColor', null)">
            Без цвета
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem v-if="isEpic" @click="$emit('addStory')">
        <Plus :size="14" class="mr-2" />
        Добавить историю
      </DropdownMenuItem>
      <DropdownMenuItem @click="$emit('toggleDone')">
        {{ toggleDoneLabel }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="text-destructive focus:text-destructive focus:bg-destructive/10"
        @click="$emit('delete')"
      >
        <Trash2 :size="14" class="mr-2" />
        Удалить
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

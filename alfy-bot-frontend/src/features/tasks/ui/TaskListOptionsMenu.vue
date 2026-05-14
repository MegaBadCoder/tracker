<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'

defineProps<{ showCompleted: boolean, hideOverdue: boolean }>()
defineEmits<{
  'update:showCompleted': [value: boolean]
  'update:hideOverdue': [value: boolean]
}>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="flex-shrink-0" aria-label="Параметры списка">
        <MoreHorizontal class="w-5 h-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuItem
        class="flex items-center justify-between cursor-pointer"
        @select.prevent="$emit('update:showCompleted', !showCompleted)"
      >
        <span>Выполненные задачи</span>
        <Switch
          :model-value="showCompleted"
          @update:model-value="$emit('update:showCompleted', $event)"
          @click.stop
        />
      </DropdownMenuItem>
      <DropdownMenuItem
        class="flex items-center justify-between cursor-pointer"
        @select.prevent="$emit('update:hideOverdue', !hideOverdue)"
      >
        <span>Скрывать просроченные</span>
        <Switch
          :model-value="hideOverdue"
          @update:model-value="$emit('update:hideOverdue', $event)"
          @click.stop
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

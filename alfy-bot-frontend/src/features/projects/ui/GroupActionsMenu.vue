<script setup lang="ts">
import type { BoardGroup } from '../model/types'
import { CircleCheck, Ellipsis, Palette, Pencil, Plus, Rocket, RotateCcw, SquareArrowOutUpRight, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
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
import { apiErrorMessage } from '../lib/api-error'
import { PROJECT_COLOR_PALETTE } from '../model/project-color-palette'
import { useReleaseStore } from '../model/release-store'

/**
 * Меню действий эпика/истории на agile-доске. «Цвет» и «Добавить историю»
 * доступны только эпику — у истории нет ни своего цвета, ни вложенных историй.
 * «В релиз…» назначает в запланированный релиз все задачи группы напрямую
 * через `release-store`, поэтому меню требует активного Pinia.
 */
const props = defineProps<{
  group: BoardGroup
}>()

const emit = defineEmits<{
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

const releaseStore = useReleaseStore()
const releaseError = ref<string | null>(null)
const plannedReleases = computed(() => releaseStore.plannedReleasesOf(props.group.projectId))

function onMenuOpenChange(open: boolean) {
  if (open)
    releaseStore.ensureReleases(props.group.projectId)
}

async function assignToRelease(releaseId: string) {
  releaseError.value = null
  try {
    await releaseStore.assignGroup(props.group.projectId, releaseId, props.group.id)
  }
  catch (err) {
    releaseError.value = apiErrorMessage(err, 'Не удалось назначить группу в релиз')
  }
}

const keepFocusOnClose = ref(false)

function startInlineEdit(action: 'rename' | 'addStory') {
  keepFocusOnClose.value = true
  if (action === 'rename')
    emit('rename')
  else
    emit('addStory')
}

function onCloseAutoFocus(event: Event) {
  if (!keepFocusOnClose.value)
    return
  keepFocusOnClose.value = false
  event.preventDefault()
}
</script>

<template>
  <DropdownMenu @update:open="onMenuOpenChange">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" :aria-label="triggerLabel">
        <Ellipsis :size="16" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" @close-auto-focus="onCloseAutoFocus">
      <DropdownMenuItem @click="$emit('open')">
        <SquareArrowOutUpRight :size="14" class="mr-2" />
        Открыть карточку
      </DropdownMenuItem>
      <DropdownMenuItem @click="startInlineEdit('rename')">
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
      <DropdownMenuItem v-if="isEpic" @click="startInlineEdit('addStory')">
        <Plus :size="14" class="mr-2" />
        Добавить историю
      </DropdownMenuItem>
      <DropdownMenuSub v-if="plannedReleases.length > 0">
        <DropdownMenuSubTrigger>
          <Rocket :size="14" class="mr-2" />
          В релиз…
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            v-for="release in plannedReleases"
            :key="release.id"
            @click="assignToRelease(release.id)"
          >
            {{ release.name }}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem @click="$emit('toggleDone')">
        <RotateCcw v-if="group.status === 'done'" :size="14" class="mr-2" />
        <CircleCheck v-else :size="14" class="mr-2" />
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
  <span v-if="releaseError" role="alert" class="text-xs text-destructive">{{ releaseError }}</span>
</template>

<script setup lang="ts">
import type { StoryWorkflowStatus } from '../model/types'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '../lib/api-error'
import { useStoryWorkflowStore } from '../model/story-workflow-store'

const props = defineProps<{ projectId: string, open: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const workflow = useStoryWorkflowStore()
const draft = ref<StoryWorkflowStatus[]>([])
const error = ref('')
const saving = ref(false)
const categories = [{ id: 'open', name: 'Проработка' }, { id: 'ready', name: 'Готова к работе' }, { id: 'in_progress', name: 'В работе' }, { id: 'review', name: 'Проверка' }, { id: 'done', name: 'Выполнена' }]
watch(() => props.open, async (open) => {
  if (!open)
    return
  await workflow.ensure(props.projectId)
  draft.value = workflow.statusesOf(props.projectId).map(status => ({ ...status }))
  error.value = workflow.errors[props.projectId] ?? ''
}, { immediate: true })

function move(index: number, offset: number) {
  const target = index + offset
  const item = draft.value[index]
  if (!item || target < 0 || target >= draft.value.length)
    return
  draft.value.splice(index, 1)
  draft.value.splice(target, 0, item)
}

function add() {
  const base = draft.value.find(s => s.category === 'in_progress') ?? draft.value[0]
  if (!base)
    return
  draft.value.push({ ...base, id: crypto.randomUUID(), name: '' })
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await workflow.save(props.projectId, draft.value.map(status => ({ ...status, name: status.name.trim() })))
    emit('update:open', false)
  }
  catch (err) { error.value = apiErrorMessage(err, 'Не удалось сохранить статусы') }
  finally { saving.value = false }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Статусы историй</DialogTitle><DialogDescription>Названия и порядок задают колонки доски. Категория определяет смысл статуса.</DialogDescription></DialogHeader>
      <form class="space-y-4" @submit.prevent="save">
        <div v-for="(status, index) in draft" :key="status.id" class="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
          <input v-model="status.color" type="color" class="h-8 w-8 shrink-0 rounded" :aria-label="`Цвет статуса ${status.name}`">
          <Input v-model="status.name" required :aria-label="`Название статуса ${index + 1}`" class="min-w-32 flex-1" />
          <select v-model="status.category" class="min-h-9 rounded-md border border-input bg-background px-2 text-sm" :aria-label="`Категория статуса ${status.name}`">
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <Button size="icon-sm" type="button" variant="ghost" :disabled="index === 0" :aria-label="`Поднять статус ${status.name}`" @click="move(index, -1)">
            <ArrowUp :size="14" />
          </Button>
          <Button size="icon-sm" type="button" variant="ghost" :disabled="index === draft.length - 1" :aria-label="`Опустить статус ${status.name}`" @click="move(index, 1)">
            <ArrowDown :size="14" />
          </Button>
          <Button size="icon-sm" type="button" variant="ghost" :aria-label="`Удалить статус ${status.name}`" @click="draft.splice(index, 1)">
            <Trash2 :size="14" />
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Используемый статус нельзя удалить. Сначала переведите истории в другой статус.
        </p>
        <p v-if="error" role="alert" class="text-sm text-destructive">
          {{ error }}
        </p>
        <div class="flex justify-between gap-2">
          <Button type="button" variant="outline" :disabled="!draft.length" @click="add">
            <Plus :size="14" />Добавить статус
          </Button><Button type="submit" :disabled="saving || !draft.length">
            Сохранить
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

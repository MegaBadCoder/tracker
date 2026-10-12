<script setup lang="ts">
import type { ProjectColumn } from '../model/types'
import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as columnsApi from '../api/columns-api'
import { apiErrorMessage } from '../lib/api-error'
import { useColumnStore } from '../model/column-store'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ busyChange: [busy: boolean]; dirtyChange: [dirty: boolean] }>()
const store = useColumnStore()
const columns = ref<ProjectColumn[]>([])
const titles = ref<Record<string, string>>({})
const newTitle = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const loaded = ref(false)
const deleting = ref<string | null>(null)
const dirty = computed(() => !!newTitle.value.trim() || columns.value.some(column => titles.value[column.id]?.trim() !== column.title))
watch(dirty, value => emit('dirtyChange', value), { flush: 'sync' })
let generation = 0
watch(busy, value => emit('busyChange', value), { flush: 'sync' })

function applyColumns(value: ProjectColumn[], sync: boolean) {
  columns.value = [...value].sort((a, b) => a.order - b.order)
  if (sync && store.currentProjectId === props.projectId)
    store.columns = columns.value.map(column => ({ ...column }))
}

async function load() {
  const request = ++generation
  loading.value = true
  loaded.value = false
  busy.value = false
  error.value = ''
  columns.value = []
  titles.value = {}
  deleting.value = null
  newTitle.value = ''
  try {
    const { data } = await columnsApi.fetchColumns(props.projectId)
    if (request !== generation) return
    applyColumns(data, false)
    titles.value = Object.fromEntries(data.map(column => [column.id, column.title]))
    loaded.value = true
  } catch (err) {
    if (request === generation) error.value = apiErrorMessage(err, 'Не удалось загрузить колонки')
  } finally {
    if (request === generation) loading.value = false
  }
}

async function run(command: (projectId: string) => Promise<() => void>) {
  if (busy.value || !loaded.value) return
  const request = generation
  busy.value = true
  error.value = ''
  try {
    const apply = await command(props.projectId)
    if (request === generation) apply()
  } catch (err) {
    if (request === generation) error.value = apiErrorMessage(err, 'Не удалось сохранить колонки')
  } finally {
    if (request === generation) busy.value = false
  }
}

async function add() {
  const title = newTitle.value.trim()
  if (!title) return
  await run(async (projectId) => {
    const { data } = await columnsApi.createColumn(projectId, { title })
    return () => {
      applyColumns([...columns.value, data], true)
      titles.value[data.id] = data.title
      newTitle.value = ''
    }
  })
}

async function rename(column: ProjectColumn) {
  const title = titles.value[column.id]?.trim()
  if (!title || title === column.title) return
  await run(async (projectId) => {
    const { data } = await columnsApi.updateColumn(projectId, column.id, { title })
    return () => {
      applyColumns(columns.value.map(item => item.id === column.id ? data : item), true)
      titles.value[column.id] = data.title
    }
  })
}

async function move(index: number, direction: number) {
  const next = index + direction
  if (next < 0 || next >= columns.value.length) return
  const reordered = [...columns.value]
  const [column] = reordered.splice(index, 1)
  if (!column) return
  reordered.splice(next, 0, column)
  await run(async (projectId) => {
    await columnsApi.reorderColumns(projectId, reordered.map(item => item.id))
    return () => applyColumns(reordered.map((item, order) => ({ ...item, order })), true)
  })
}

async function remove(id: string) {
  await run(async (projectId) => {
    await columnsApi.deleteColumn(projectId, id)
    return () => {
      applyColumns(columns.value.filter(column => column.id !== id), true)
      deleting.value = null
    }
  })
}

watch(() => props.projectId, load, { immediate: true })
</script>

<template>
  <section class="space-y-3" aria-label="Колонки проекта">
    <p class="text-xs text-muted-foreground">Изменения сохраняются сразу. Удалить можно только колонку без задач, включая завершённые и задачи других спринтов.</p>
    <p v-if="loading" class="text-sm text-muted-foreground" role="status">Загрузка колонок…</p>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <Button v-if="!loading && !loaded" type="button" variant="outline" size="sm" @click="load">Повторить загрузку</Button>
    <template v-if="loaded">
      <p v-if="!columns.length" class="text-sm text-muted-foreground">Пока нет колонок. Добавьте первую.</p>
      <div v-for="(column, index) in columns" :key="column.id" class="space-y-2" :data-column-id="column.id">
        <form class="flex items-center gap-1" @submit.prevent="rename(column)">
          <Input v-model="titles[column.id]" :aria-label="`Название колонки ${column.title}`" :disabled="busy" class="min-w-0 flex-1" />
          <Button type="submit" variant="ghost" size="icon" :aria-label="`Сохранить название ${column.title}`" :disabled="busy || !titles[column.id]?.trim() || titles[column.id]?.trim() === column.title"><Check :size="16" /></Button>
          <Button type="button" variant="ghost" size="icon" :aria-label="`Переместить ${column.title} выше`" :disabled="busy || index === 0" @click="move(index, -1)"><ArrowUp :size="16" /></Button>
          <Button type="button" variant="ghost" size="icon" :aria-label="`Переместить ${column.title} ниже`" :disabled="busy || index === columns.length - 1" @click="move(index, 1)"><ArrowDown :size="16" /></Button>
          <Button type="button" variant="ghost" size="icon" :aria-label="`Удалить колонку ${column.title}`" :disabled="busy" @click="deleting = column.id"><Trash2 :size="16" /></Button>
        </form>
        <div v-if="deleting === column.id" class="rounded-md border p-3 text-sm space-y-2">
          <p>Удалить колонку «{{ column.title }}»?</p>
          <div class="flex gap-2">
            <Button type="button" size="sm" variant="destructive" :disabled="busy" @click="remove(column.id)">Удалить</Button>
            <Button type="button" size="sm" variant="ghost" :disabled="busy" @click="deleting = null">Отмена удаления</Button>
          </div>
        </div>
      </div>
      <form class="flex gap-2" @submit.prevent="add">
        <Input v-model="newTitle" aria-label="Название новой колонки" placeholder="Название колонки" :disabled="busy" class="min-w-0 flex-1" />
        <Button type="submit" variant="outline" :disabled="busy || !newTitle.trim()">Добавить</Button>
      </form>
      <p v-if="busy" role="status" class="text-xs text-muted-foreground">Сохранение…</p>
    </template>
  </section>
</template>

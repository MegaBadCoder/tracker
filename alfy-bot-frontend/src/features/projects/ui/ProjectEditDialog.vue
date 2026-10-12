<template>
  <Dialog :open="open" @update:open="requestClose">
    <DialogContent class="project-settings flex h-[min(90dvh,40rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-lg">
      <Tabs v-model="activeTab" class="min-h-0 flex-1 gap-0 overflow-hidden">
      <header class="shrink-0 px-6 pt-6 pb-4">
        <DialogTitle class="text-lg font-semibold tracking-tight">Настройки проекта</DialogTitle>
        <DialogDescription class="mt-1 truncate text-sm text-muted-foreground">{{ project?.title }}</DialogDescription>
          <TabsList v-if="isAgile" class="mt-4 w-full" aria-label="Настройки проекта">
            <TabsTrigger value="general" :disabled="busy" class="transition-none">Основное</TabsTrigger>
            <TabsTrigger value="columns" :disabled="busy" class="transition-none">Колонки</TabsTrigger>
          </TabsList>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6" :aria-busy="busy">
        <TabsContent value="general" force-mount class="data-[state=inactive]:hidden">
        <form :id="formId" class="space-y-5" @submit.prevent="handleSave">
          <fieldset :disabled="busy" class="min-w-0 space-y-5">
            <div class="space-y-2">
              <label :for="titleId" class="text-sm font-medium">Название</label>
              <div class="flex items-center gap-2">
                <IconPicker v-model="localIcon" :icon-color="localColor" />
                <Input :id="titleId" v-model="localTitle" class="min-w-0 flex-1" placeholder="Название проекта" autocomplete="off" />
                <ColorPicker v-model="localColor" />
              </div>
            </div>
            <div class="space-y-2">
              <label :for="descriptionId" class="text-sm font-medium">Описание</label>
              <Input :id="descriptionId" v-model="localDescription" placeholder="О чём этот проект" />
            </div>
            <div class="space-y-2">
              <span class="text-sm font-medium">Родительский проект</span>
              <ProjectPicker :model-value="localParentId" context="parent" :exclude-ids="excludedIds" @update:model-value="localParentId = $event" />
            </div>
            <TaskKeyPrefixField v-if="isAgile" v-model="localTaskKeyPrefix" />
          </fieldset>
        </form>
        </TabsContent>
        <TabsContent v-if="isAgile" value="columns" force-mount class="data-[state=inactive]:hidden">
        <ProjectColumnSettings v-if="open && isAgile && project" :key="project.id" :project-id="project.id" @busy-change="columnsBusy = $event" @dirty-change="columnsDirty = $event" />
        </TabsContent>
        <p v-if="errorMessage" role="alert" class="mt-4 text-sm text-destructive" data-testid="project-edit-error">{{ errorMessage }}</p>
      </div>

      <footer class="shrink-0 bg-muted/20 px-6 py-4">
        <div v-if="confirmClose" class="space-y-3" role="alert">
          <p class="text-sm">Изменения не сохранены. Закрыть окно?</p>
          <div class="flex justify-end gap-2">
            <Button variant="outline" type="button" @click="confirmClose = false">Вернуться</Button>
            <Button variant="destructive" type="button" @click="discard">Не сохранять</Button>
          </div>
        </div>
        <div v-else class="flex items-center justify-between gap-3">
          <p class="text-xs text-muted-foreground" aria-live="polite">{{ busy ? 'Сохранение…' : activeTab === 'columns' ? 'Колонки сохраняются сразу' : dirty ? 'Есть несохранённые изменения' : '' }}</p>
          <div class="flex shrink-0 gap-2">
            <Button variant="outline" type="button" :disabled="busy" @click="requestClose(false)">{{ activeTab === 'columns' ? 'Готово' : 'Отмена' }}</Button>
            <Button v-if="activeTab === 'general'" type="submit" :form="formId" :disabled="busy || !canSave || !dirty">{{ saving ? 'Сохранение…' : 'Сохранить' }}</Button>
          </div>
        </div>
      </footer>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { Project } from '../model/types'
import { ref, watch, computed, useId } from 'vue'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { apiErrorMessage } from '../lib/api-error'
import { isObviouslyInvalidTaskKeyPrefix } from '../lib/task-key'
import { useProjectStore } from '../model/project-store'
import ProjectPicker from './ProjectPicker.vue'
import IconPicker from './IconPicker.vue'
import ColorPicker from './ColorPicker.vue'
import TaskKeyPrefixField from './TaskKeyPrefixField.vue'
import ProjectColumnSettings from './ProjectColumnSettings.vue'

const props = defineProps<{
  project: Project | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useProjectStore()
const saving = ref(false)
const columnsBusy = ref(false)
const columnsDirty = ref(false)
const activeTab = ref('general')
const confirmClose = ref(false)
const formId = useId()
const titleId = useId()
const descriptionId = useId()
const initialValues = ref('')
const isAgile = computed(() => props.project?.type === 'agile')
const busy = computed(() => saving.value || columnsBusy.value)

function formValues() {
  return {
    title: localTitle.value.trim(),
    description: localDescription.value.trim() || null,
    parentId: localParentId.value,
    icon: localIcon.value,
    color: localColor.value,
    ...(isAgile.value && { taskKeyPrefix: localTaskKeyPrefix.value.trim() || null }),
  }
}

const dirty = computed(() => JSON.stringify(formValues()) !== initialValues.value)

function requestClose(open: boolean) {
  if (open || busy.value) return
  if (dirty.value || columnsDirty.value) {
    confirmClose.value = true
    return
  }
  emit('update:open', false)
}

function discard() {
  if (!busy.value) emit('update:open', false)
}

const localTitle = ref('')
const localDescription = ref('')
const localParentId = ref<string | null>(null)
const localIcon = ref<string | null>(null)
const localColor = ref<string | null>(null)
const localTaskKeyPrefix = ref('')
const errorMessage = ref<string | null>(null)

const canSave = computed(() =>
  localTitle.value.trim().length > 0 && !isObviouslyInvalidTaskKeyPrefix(localTaskKeyPrefix.value),
)

const excludedIds = computed(() => {
  if (!props.project) return []
  const ids = [props.project.id]
  function collectDescendants(parentId: string) {
    for (const p of store.projects) {
      if (p.parentId === parentId) {
        ids.push(p.id)
        collectDescendants(p.id)
      }
    }
  }
  collectDescendants(props.project.id)
  return ids
})

watch(() => [props.open, props.project?.id] as const, ([open]) => {
  if (open && props.project) {
    localTitle.value = props.project.title
    localDescription.value = props.project.description ?? ''
    localParentId.value = props.project.parentId
    localIcon.value = props.project.icon
    localColor.value = props.project.color
    localTaskKeyPrefix.value = props.project.taskKeyPrefix ?? ''
    errorMessage.value = null
    activeTab.value = 'general'
    confirmClose.value = false
    columnsDirty.value = false
    columnsBusy.value = false
    initialValues.value = JSON.stringify(formValues())
  }
}, { immediate: true })

async function handleSave() {
  if (busy.value || !props.project || !canSave.value || !dirty.value) return

  errorMessage.value = null
  saving.value = true
  try {
    await store.updateProject(props.project.id, formValues())
    initialValues.value = JSON.stringify(formValues())
    if (columnsDirty.value) activeTab.value = 'columns'
    else emit('update:open', false)
  } catch (err) {
    console.error('Ошибка обновления проекта:', err)
    errorMessage.value = apiErrorMessage(err, 'Не удалось сохранить проект')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .project-settings {
    animation: none;
  }
}
@media (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .project-settings :deep(button:not([role="tab"])) {
    transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .project-settings :deep(button:active:not(:disabled):not(:focus-visible):not([role="tab"])) {
    transform: scale(0.97);
  }
}
</style>

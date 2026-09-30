<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Редактировать проект</h2>

        <div class="flex items-center gap-3">
          <IconPicker v-model="localIcon" :icon-color="localColor" />
          <ColorPicker v-model="localColor" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            v-model="localTitle"
            placeholder="Название проекта"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Input
            v-model="localDescription"
            placeholder="Описание (необязательно)"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Родительский проект</label>
          <ProjectPicker
            :model-value="localParentId"
            context="parent"
            :exclude-ids="excludedIds"
            @update:model-value="localParentId = $event"
          />
        </div>

        <TaskKeyPrefixField v-if="project?.type === 'agile'" v-model="localTaskKeyPrefix" />

        <p v-if="errorMessage" class="text-sm text-destructive" role="alert" data-testid="project-edit-error">
          {{ errorMessage }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" @click="$emit('update:open', false)">
            Отмена
          </Button>
          <Button :disabled="!canSave" @click="handleSave">
            Сохранить
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { Project } from '../model/types'
import { ref, watch, computed } from 'vue'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '../lib/api-error'
import { isObviouslyInvalidTaskKeyPrefix } from '../lib/task-key'
import { useProjectStore } from '../model/project-store'
import ProjectPicker from './ProjectPicker.vue'
import IconPicker from './IconPicker.vue'
import ColorPicker from './ColorPicker.vue'
import TaskKeyPrefixField from './TaskKeyPrefixField.vue'

const props = defineProps<{
  project: Project | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useProjectStore()

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

watch(() => props.open, (val) => {
  if (val && props.project) {
    localTitle.value = props.project.title
    localDescription.value = props.project.description ?? ''
    localParentId.value = props.project.parentId
    localIcon.value = props.project.icon
    localColor.value = props.project.color
    localTaskKeyPrefix.value = props.project.taskKeyPrefix ?? ''
    errorMessage.value = null
  }
})

async function handleSave() {
  if (!props.project || !canSave.value) return

  errorMessage.value = null
  try {
    await store.updateProject(props.project.id, {
      title: localTitle.value.trim(),
      description: localDescription.value.trim() || null,
      parentId: localParentId.value,
      icon: localIcon.value,
      color: localColor.value,
      ...(props.project.type === 'agile' && { taskKeyPrefix: localTaskKeyPrefix.value.trim() || null }),
    })
    emit('update:open', false)
  } catch (err) {
    console.error('Ошибка обновления проекта:', err)
    errorMessage.value = apiErrorMessage(err, 'Не удалось сохранить проект')
  }
}
</script>

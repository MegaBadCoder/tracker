<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Новый проект</h2>

        <div class="flex items-center gap-3">
          <IconPicker v-model="icon" :icon-color="color" />
          <ColorPicker v-model="color" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            v-model="title"
            placeholder="Название проекта"
            autofocus
            @keydown.enter="handleSubmit"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Описание</label>
          <Input
            v-model="description"
            placeholder="Описание (необязательно)"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Родительский проект</label>
          <ProjectPicker
            :model-value="localParentId"
            context="parent"
            @update:model-value="localParentId = $event"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" @click="$emit('update:open', false)">
            Отмена
          </Button>
          <Button :disabled="!title.trim()" @click="handleSubmit">
            Создать
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '../model/project-store'
import ProjectPicker from './ProjectPicker.vue'
import IconPicker from './IconPicker.vue'
import ColorPicker from './ColorPicker.vue'

const props = defineProps<{
  open: boolean
  parentId?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const title = ref('')
const description = ref('')
const icon = ref<string | null>(null)
const color = ref<string | null>(null)
const localParentId = ref<string | null>(null)

const store = useProjectStore()

watch(() => props.open, (val) => {
  if (val) {
    title.value = ''
    description.value = ''
    icon.value = null
    color.value = null
    localParentId.value = props.parentId ?? null
  }
})

async function handleSubmit() {
  if (!title.value.trim()) return

  try {
    await store.createProject({
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      parentId: localParentId.value,
      icon: icon.value,
      color: color.value,
    })
    emit('update:open', false)
  } catch (err) {
    console.error('Ошибка создания проекта:', err)
  }
}
</script>

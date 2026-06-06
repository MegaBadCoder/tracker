<script setup lang="ts">
import { ImagePlus, Upload } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'
import { Button } from '@/components/ui/button'

const emit = defineEmits<{
  (e: 'submitPhoto', file: File): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  // Без жёсткой валидации типа/размера — бэк фильтрует. Подсказка лимита в шаблоне.
  if (!file)
    return
  revokePreview()
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function onUpload() {
  if (!selectedFile.value)
    return
  emit('submitPhoto', selectedFile.value)
}

onBeforeUnmount(revokePreview)
</script>

<template>
  <div class="flex flex-col gap-3">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture
      class="hidden"
      data-testid="photo-file"
      @change="onFileChange"
    >

    <img
      v-if="previewUrl"
      :src="previewUrl"
      alt="Превью фото"
      class="max-h-64 w-full rounded-md object-contain"
      data-testid="photo-preview"
    >

    <Button
      variant="outline"
      size="lg"
      data-testid="photo-pick"
      @click="pickFile"
    >
      <ImagePlus class="size-4" />
      {{ selectedFile ? 'Выбрать другое фото' : 'Выбрать фото' }}
    </Button>

    <p class="text-xs text-muted-foreground">
      До 10 МБ, форматы изображений.
    </p>

    <Button
      v-if="selectedFile"
      size="lg"
      data-testid="photo-upload"
      @click="onUpload"
    >
      <Upload class="size-4" />
      Загрузить
    </Button>
  </div>
</template>

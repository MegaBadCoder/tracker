<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PhotoGalleryEntry } from '../../../api/reports'

const props = defineProps<{
  questionText: string
  entries: PhotoGalleryEntry[]
}>()

const selectedIndex = ref<number | null>(null)

const selectedEntry = computed<PhotoGalleryEntry | null>(() =>
  selectedIndex.value !== null ? (props.entries[selectedIndex.value] ?? null) : null,
)

function openLightbox(index: number) {
  selectedIndex.value = index
}

function closeLightbox() {
  selectedIndex.value = null
}

function formatDate(scheduled_date: string): string {
  return new Date(scheduled_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div v-if="entries.length === 0" class="text-sm text-muted-foreground py-8 text-center">
    Пока нет фото
  </div>

  <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
    <button
      v-for="(entry, index) in entries"
      :key="entry.scheduled_date"
      data-testid="gallery-cell"
      class="flex flex-col items-center gap-1 focus:outline-none"
      @click="openLightbox(index)"
    >
      <img
        :src="entry.url"
        loading="lazy"
        class="aspect-square object-cover rounded-md w-full"
        :alt="formatDate(entry.scheduled_date)"
      />
      <span class="text-xs text-muted-foreground">{{ formatDate(entry.scheduled_date) }}</span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="selectedEntry !== null"
      data-testid="lightbox-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click="closeLightbox"
    >
      <img
        :src="selectedEntry!.url"
        class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        :alt="formatDate(selectedEntry!.scheduled_date)"
      />
    </div>
  </Teleport>
</template>

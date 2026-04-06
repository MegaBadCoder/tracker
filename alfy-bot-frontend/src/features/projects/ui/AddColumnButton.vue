<template>
  <div class="shrink-0 w-72">
    <div v-if="editing" class="p-2">
      <Input
        ref="inputRef"
        v-model="title"
        placeholder="Название колонки"
        class="text-sm"
        autofocus
        @keydown.enter="handleAdd"
        @keydown.escape="editing = false"
        @blur="handleBlur"
      />
    </div>
    <button
      v-else
      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors cursor-pointer"
      @click="startEditing"
    >
      <Plus :size="16" />
      Добавить колонку
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Plus } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'

const emit = defineEmits<{
  add: [title: string]
}>()

const editing = ref(false)
const title = ref('')
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function startEditing() {
  editing.value = true
  title.value = ''
  nextTick(() => {
    inputRef.value?.$el?.focus()
  })
}

function handleAdd() {
  if (!title.value.trim()) return
  emit('add', title.value.trim())
  title.value = ''
  editing.value = false
}

function handleBlur() {
  if (!title.value.trim()) {
    editing.value = false
  }
}
</script>

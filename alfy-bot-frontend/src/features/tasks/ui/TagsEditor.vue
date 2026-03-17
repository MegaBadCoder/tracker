<template>
  <div class="p-3 space-y-2">
    <div v-if="editable" class="flex gap-2">
      <Input
        v-model="newTag"
        placeholder="Новый тег"
        class="h-8 text-sm"
        @keyup.enter="addTag"
      />
      <Button size="sm" variant="secondary" class="h-8 px-2 cursor-pointer" @click="addTag">
        <Plus :size="14" />
      </Button>
    </div>
    <div v-if="modelValue.length" class="flex flex-wrap gap-1 pt-1">
      <Badge
        v-for="tag in modelValue"
        :key="tag"
        variant="secondary"
        class="gap-1 text-xs"
      >
        {{ tag }}
        <X
          v-if="editable"
          :size="12"
          class="cursor-pointer opacity-60 hover:opacity-100 transition-opacity duration-150"
          @click="removeTag(tag)"
        />
      </Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const props = withDefaults(defineProps<{
  modelValue: string[]
  editable?: boolean
}>(), {
  editable: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const newTag = ref('')

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag])
    newTag.value = ''
  }
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}
</script>

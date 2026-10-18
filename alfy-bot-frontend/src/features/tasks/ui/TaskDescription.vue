<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { Pencil } from 'lucide-vue-next'
import { nextTick, ref, useId, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import MarkdownContent from '@/shared/ui/MarkdownContent.vue'

const props = defineProps<{
  description: string
  editable: boolean
}>()

const emit = defineEmits<{
  save: [description: string]
}>()

const helpId = useId()
const editing = ref(false)
const draft = ref('')
const expanded = ref(false)
const overflows = ref(false)
const preview = ref<HTMLElement | null>(null)
const editor = ref<InstanceType<typeof Textarea> | null>(null)
const editButton = ref<InstanceType<typeof Button> | null>(null)
const PREVIEW_MAX_HEIGHT = 227.5

function measurePreview() {
  overflows.value = (preview.value?.scrollHeight ?? 0) > PREVIEW_MAX_HEIGHT + 1
}

useResizeObserver(preview, measurePreview)
watch(() => props.description, () => nextTick(measurePreview), { immediate: true })
watch(editing, () => nextTick(measurePreview))
watch(() => props.editable, (editable) => {
  if (!editable) {
    editing.value = false
    draft.value = ''
  }
})

async function startEditing() {
  if (!props.editable)
    return
  draft.value = props.description
  editing.value = true
  await nextTick()
  editor.value?.$el.focus()
}

async function finishEditing() {
  editing.value = false
  await nextTick()
  editButton.value?.$el.focus()
}

function save() {
  if (!props.editable)
    return
  if (draft.value !== props.description)
    emit('save', draft.value)
  finishEditing()
}
</script>

<template>
  <section class="space-y-2" aria-label="Описание задачи">
    <template v-if="editing && editable">
      <Textarea
        ref="editor"
        v-model="draft"
        aria-label="Описание задачи"
        :aria-describedby="helpId"
        placeholder="Добавить описание..."
        rows="8"
        class="min-h-40 resize-y leading-relaxed"
        @keydown.esc.stop.prevent="finishEditing"
      />
      <p :id="helpId" class="text-xs text-muted-foreground">
        Поддерживается Markdown. Ссылка: [название](https://example.com)
      </p>
      <div class="flex items-center gap-2">
        <Button type="button" size="sm" @click="save">
          Сохранить
        </Button>
        <Button type="button" size="sm" variant="ghost" @click="finishEditing">
          Отмена
        </Button>
      </div>
    </template>
    <template v-else>
      <div
        v-if="description"
        class="relative overflow-hidden"
        :style="!expanded && overflows ? { maxHeight: `${PREVIEW_MAX_HEIGHT}px` } : undefined"
      >
        <div ref="preview" class="text-sm leading-relaxed text-foreground/80">
          <MarkdownContent :content="description" />
        </div>
        <div
          v-if="!expanded && overflows"
          class="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent"
        />
      </div>
      <p v-else-if="!editable" class="text-sm italic text-muted-foreground">
        Нет описания
      </p>
      <div v-if="overflows || editable" class="flex items-center gap-3">
        <button
          v-if="overflows"
          type="button"
          :aria-expanded="expanded"
          class="text-xs text-primary hover:underline cursor-pointer"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Свернуть' : 'Подробнее' }}
        </button>
        <Button
          v-if="editable"
          ref="editButton"
          type="button"
          size="sm"
          variant="ghost"
          class="text-muted-foreground -ml-2"
          @click="startEditing"
        >
          <Pencil :size="13" />
          {{ description ? 'Редактировать' : 'Добавить описание' }}
        </Button>
      </div>
    </template>
  </section>
</template>

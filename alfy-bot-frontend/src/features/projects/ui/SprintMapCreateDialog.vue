<script setup lang="ts">
import type { SprintMapCreateContext } from '../lib/use-sprint-map-create'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSprintMapCreate } from '../lib/use-sprint-map-create'

const props = defineProps<{
  context: SprintMapCreateContext
  sprintName: string
  closed: boolean
}>()
const emit = defineEmits<{ close: [], created: [id: string] }>()
const { pending, error, epicId, storyId, submit } = useSprintMapCreate(props.context, () => props.closed)
const title = ref('')
const firstStoryTitle = ref('')
const heading = computed(() => ({ task: 'Новая задача', story: 'Новая история', epic: 'Новый эпик' })[props.context.kind])
const partial = computed(() => storyId.value
  ? 'История уже создана в бэклоге. Осталось назначить её в спринт. Повтор продолжит этот шаг без дубликатов.'
  : epicId.value ? 'Эпик уже создан. Осталось создать первую историю и назначить её в спринт. Повтор использует этот эпик.' : '')

async function save() {
  const id = await submit(title.value, firstStoryTitle.value)
  if (id)
    emit('created', id)
}
</script>

<template>
  <Dialog :open="true" @update:open="!$event && !pending && emit('close')">
    <DialogContent @escape-key-down="pending && $event.preventDefault()" @interact-outside="pending && $event.preventDefault()">
      <DialogHeader>
        <DialogTitle>{{ heading }}</DialogTitle>
        <DialogDescription>
          {{ context.kind === 'epic' ? 'Первая история свяжет эпик со спринтом' : 'Сразу добавим в спринт' }} «{{ sprintName }}».
        </DialogDescription>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="save">
        <label class="grid gap-1.5 text-sm font-medium">
          Название
          <Input v-model="title" aria-label="Название нового элемента" :disabled="pending || !!epicId || !!storyId" autofocus maxlength="255" />
        </label>
        <label v-if="context.kind === 'epic'" class="grid gap-1.5 text-sm font-medium">
          Первая история
          <Input v-model="firstStoryTitle" aria-label="Название первой истории" :disabled="pending || !!storyId" maxlength="255" />
        </label>
        <p v-if="partial" role="status" class="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {{ partial }} Если закрыть форму, созданные элементы останутся в бэклоге.
        </p>
        <p v-if="error" role="alert" class="text-sm text-destructive">
          {{ error }}
        </p>
        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" :disabled="pending" @click="emit('close')">
            Закрыть
          </Button>
          <Button type="submit" :disabled="pending || closed || !title.trim() || (context.kind === 'epic' && !firstStoryTitle.trim())">
            {{ pending ? 'Сохраняем…' : partial ? 'Продолжить сохранение' : 'Создать' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

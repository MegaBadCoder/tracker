<script setup lang="ts">
import type { BoardGroup, UpdateGroupPayload } from '../model/types'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '../lib/api-error'
import { useGroupStore } from '../model/group-store'
import StoryStatusPicker from './StoryStatusPicker.vue'

const props = defineProps<{ story: BoardGroup }>()
const groups = useGroupStore()
const blockedReason = ref('')
const deferredUntil = ref('')
const dependencyIds = ref<string[]>([])
const archived = ref(false)
const saving = ref(false)
const error = ref('')
const saved = ref(false)
const dependencies = computed(() => groups.groupsOf(props.story.projectId).flatMap(e => e.children).filter(s => s.id !== props.story.id))
const missingDependencies = computed(() => dependencyIds.value.filter(id => !dependencies.value.some(story => story.id === id)))
watch([() => props.story.id, () => props.story.blockedReason, () => props.story.deferredUntil, () => props.story.archived, () => props.story.dependencyIds?.join(',')], () => {
  const story = props.story
  blockedReason.value = story.blockedReason ?? ''
  deferredUntil.value = story.deferredUntil ?? ''
  dependencyIds.value = [...(story.dependencyIds ?? [])]
  archived.value = story.archived ?? false
  saved.value = false
}, { immediate: true })

async function save() {
  saving.value = true
  error.value = ''
  const patch: UpdateGroupPayload = { blockedReason: blockedReason.value.trim() || null, deferredUntil: deferredUntil.value || null, archived: archived.value, dependencyIds: dependencyIds.value }
  try {
    await groups.updateGroup(props.story.projectId, props.story.id, patch)
    saved.value = true
  }
  catch (err) { error.value = apiErrorMessage(err, 'Не удалось сохранить условия работы') }
  finally { saving.value = false }
}
</script>

<template>
  <form class="space-y-3 p-4 text-sm" @submit.prevent="save">
    <StoryStatusPicker :story="story" />
    <label class="grid gap-1.5 text-xs">Что мешает работе
      <Textarea v-model="blockedReason" placeholder="Причина блокировки" aria-label="Причина блокировки истории" class="min-h-16 text-sm" />
    </label>
    <label class="grid gap-1.5 text-xs">Отложить до
      <Input v-model="deferredUntil" type="date" aria-label="Отложить историю до" />
    </label>
    <fieldset v-if="dependencies.length || missingDependencies.length" class="space-y-1.5">
      <legend class="mb-2 text-xs text-muted-foreground">
        Зависит от историй
      </legend>
      <label v-for="dependency in dependencies" :key="dependency.id" class="flex items-start gap-2 text-xs">
        <input v-model="dependencyIds" type="checkbox" :value="dependency.id" class="mt-0.5 accent-primary">
        <span>{{ dependency.title }}<span v-if="dependency.status === 'done'" class="text-muted-foreground"> · выполнена</span></span>
      </label>
      <label v-for="id in missingDependencies" :key="id" class="flex items-center gap-2 text-xs text-destructive"><input v-model="dependencyIds" type="checkbox" :value="id" class="accent-primary">История удалена — снимите зависимость</label>
    </fieldset>
    <label class="flex items-center gap-2 text-xs"><input v-model="archived" type="checkbox" class="accent-primary">В архиве</label>
    <p v-if="error" role="alert" class="text-xs text-destructive">
      {{ error }}
    </p>
    <p v-if="saved" role="status" class="text-xs text-muted-foreground">
      Условия сохранены
    </p>
    <Button size="sm" type="submit" :disabled="saving">
      Сохранить условия
    </Button>
  </form>
</template>

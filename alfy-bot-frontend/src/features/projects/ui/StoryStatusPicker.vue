<script setup lang="ts">
import type { BoardGroup } from '../model/types'
import { computed, ref, watch } from 'vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '../lib/api-error'
import { useGroupStore } from '../model/group-store'
import { useStoryWorkflowStore } from '../model/story-workflow-store'

const props = defineProps<{ story: BoardGroup }>()
const groups = useGroupStore()
const workflow = useStoryWorkflowStore()
const saving = ref(false)
const error = ref('')
const statuses = computed(() => workflow.statusesOf(props.story.projectId))
const current = computed(() => statuses.value.find(s => s.id === props.story.workflowStatusId)
  ?? statuses.value.find(s => s.category === (props.story.status === 'done' ? 'done' : 'open')))
watch(() => props.story.projectId, id => workflow.ensure(id), { immediate: true })

async function select(id: string) {
  if (saving.value)
    return
  saving.value = true
  error.value = ''
  try {
    await groups.updateGroup(props.story.projectId, props.story.id, { workflowStatusId: id })
  }
  catch (err) { error.value = apiErrorMessage(err, 'Не удалось изменить статус') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="min-w-0" @click.stop>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button type="button" :disabled="saving" class="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" :aria-label="`Статус истории ${story.title}`">
          <span v-if="current" class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: current.color }" />
          <span class="truncate">{{ current?.name ?? (story.status === 'done' ? 'Выполнена' : 'Открыта') }}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem v-for="status in statuses" :key="status.id" :disabled="status.id === current?.id" @select="select(status.id)">
          <span class="mr-2 size-2 rounded-full" :style="{ backgroundColor: status.color }" />{{ status.name }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="!statuses.length" @select="workflow.fetch(story.projectId)">
          Загрузить статусы
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <p v-if="error || workflow.errors[story.projectId]" role="alert" class="mt-1 max-w-64 text-xs text-destructive">
      {{ error || workflow.errors[story.projectId] }}
    </p>
  </div>
</template>

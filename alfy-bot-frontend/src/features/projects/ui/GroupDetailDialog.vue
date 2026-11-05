<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { openTaskDetail } from '@/features/tasks/lib/task-detail-navigation'
import * as groupsApi from '../api/groups-api'
import { apiErrorMessage } from '../lib/api-error'
import { findGroup } from '../lib/group-tree'
import { useGroupDeletion } from '../lib/use-group-deletion'
import { useGroupStore } from '../model/group-store'
import { useReleaseStore } from '../model/release-store'
import { useGroupDetail } from '../model/use-group-detail'
import GroupDetailContent from './GroupDetailContent.vue'

const detail = useGroupDetail()
const groups = useGroupStore()
const releases = useReleaseStore()
const { deleteGroupWithConfirm } = useGroupDeletion()
const target = computed(() => detail.current.value)
const group = computed(() => target.value ? findGroup(groups.groupsOf(target.value.projectId), target.value.groupId) : null)
const loading = ref(false)
const error = ref('')
const retry = ref(0)
watch([target, retry], async ([value], _, onCleanup) => {
  let active = true
  onCleanup(() => {
    active = false
  })
  error.value = ''
  loading.value = false
  if (!value)
    return
  loading.value = true
  try {
    if (!(value.projectId in groups.trees)) {
      const { data } = await groupsApi.fetchGroups(value.projectId)
      if (!active)
        return
      groups.trees[value.projectId] = data
    }
    await releases.ensureReleases(value.projectId)
    if (active && !findGroup(groups.groupsOf(value.projectId), value.groupId))
      detail.close()
  }
  catch (err) {
    if (active)
      error.value = apiErrorMessage(err, 'Не удалось загрузить группу')
  }
  finally {
    if (active)
      loading.value = false
  }
}, { immediate: true })

function openTask(task: Task) {
  detail.close()
  openTaskDetail(task)
}

async function removeGroup() {
  const current = target.value
  const selected = group.value
  if (!current || !selected)
    return
  detail.close()
  await deleteGroupWithConfirm(current.projectId, selected)
}
</script>

<template>
  <Dialog :open="!!target" @update:open="!$event && detail.close()">
    <DialogContent class="flex max-h-[95dvh] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl [&>button:last-child]:hidden">
      <DialogTitle class="sr-only">
        {{ group?.title ?? 'Группа' }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        Быстрый просмотр и редактирование группы
      </DialogDescription>
      <div v-if="loading || error" class="space-y-3 p-5">
        <p v-if="loading" role="status">
          Загрузка…
        </p>
        <p v-if="error" role="alert">
          {{ error }}
        </p>
        <Button v-if="error" variant="outline" @click="retry++">
          Повторить
        </Button>
        <Button variant="ghost" @click="detail.close()">
          Закрыть
        </Button>
      </div>
      <GroupDetailContent
        v-else-if="target && group"
        :key="`${target.projectId}/${target.groupId}`"
        :project-id="target.projectId"
        :group-id="target.groupId"
        presentation="preview"
        @close="detail.close()"
        @open-group="detail.open(target.projectId, $event)"
        @open-task="openTask"
        @delete="removeGroup"
      />
    </DialogContent>
  </Dialog>
</template>

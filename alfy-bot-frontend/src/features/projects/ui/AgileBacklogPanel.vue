<script setup lang="ts">
import type { BoardGroupNode } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { Badge } from '@/components/ui/badge'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import { useAgileDnd } from '../lib/use-agile-dnd'
import { useGroupStore } from '../model/group-store'

// "Backlog" means tasks not on the board. Today that predicate is
// columnId === null; later (sprints) it will change to "not in the active
// sprint" without this panel's shape changing — hence no "column" naming here.
const props = withDefaults(defineProps<{
  projectId: string
  showCompleted?: boolean
  hideOverdue?: boolean
}>(), {
  showCompleted: true,
  hideOverdue: true,
})

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
}>()

const NARROW_SCREEN_BREAKPOINT_PX = 768

const groupStore = useGroupStore()
const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)
const { onTaskChange } = useAgileDnd(taskStore)

const collapsed = ref(window.innerWidth < NARROW_SCREEN_BREAKPOINT_PX)

const backlogTasks = computed(() =>
  tasks.value.filter(t =>
    t.projectId === props.projectId
    && t.columnId === null
    && (props.showCompleted || !t.completed)
    && (!props.hideOverdue || !t.isOverdue),
  ),
)

const groupById = computed(() => {
  const map = new Map<string, BoardGroupNode>()
  function walk(nodes: BoardGroupNode[]) {
    for (const node of nodes) {
      map.set(node.id, node)
      walk(node.children)
    }
  }
  walk(groupStore.groupsOf(props.projectId))
  return map
})

function groupLabel(task: Task): string | null {
  if (!task.groupId)
    return null
  return groupById.value.get(task.groupId)?.title ?? null
}

function handleChange(event: any) {
  // groupId is intentionally undefined (not null): dropping a task into the
  // backlog must not touch its epic/story assignment.
  onTaskChange(event, null, undefined, props.projectId, backlogTasks.value)
}

watch(() => props.projectId, (id) => {
  if (id)
    groupStore.fetchGroups(id)
}, { immediate: true })
</script>

<template>
  <aside
    class="flex flex-col border-l border-border bg-background shrink-0 transition-[width] duration-150"
    :class="collapsed ? 'w-10' : 'w-72'"
  >
    <button
      class="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 text-left cursor-pointer hover:bg-muted/40"
      :aria-label="collapsed ? 'Развернуть бэклог' : 'Свернуть бэклог'"
      @click="collapsed = !collapsed"
    >
      <ChevronRight v-if="collapsed" :size="16" class="shrink-0" />
      <ChevronDown v-else :size="16" class="shrink-0" />
      <template v-if="!collapsed">
        <span class="text-sm font-medium truncate">Бэклог</span>
        <span class="text-xs text-muted-foreground shrink-0 ml-auto">{{ backlogTasks.length }}</span>
      </template>
    </button>

    <div v-if="!collapsed" class="flex-1 min-h-0 overflow-y-auto p-2">
      <draggable
        :model-value="backlogTasks"
        item-key="id"
        :group="{ name: 'agile-tasks' }"
        :animation="150"
        ghost-class="opacity-30"
        class="space-y-2 min-h-[20px]"
        @change="handleChange"
      >
        <template #item="{ element }">
          <div>
            <Badge
              v-if="groupLabel(element)"
              variant="outline"
              class="mb-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
            >
              {{ groupLabel(element) }}
            </Badge>
            <TaskCard
              :task="element"
              variant="compact"
              :dnd-source="false"
              @toggle="$emit('toggleTask', $event)"
              @open="$emit('openTask', $event)"
            />
          </div>
        </template>
      </draggable>
    </div>
  </aside>
</template>

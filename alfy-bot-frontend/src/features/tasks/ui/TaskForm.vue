<template>
  <div class="bg-card rounded-xl p-6 shadow-lg dark:shadow-xl dark:shadow-black/20 border border-border space-y-4">
    <Input
      v-model="form.title"
      placeholder="Название задачи"
      class="text-lg font-medium"
      @keyup.enter="handleSubmit"
    />

    <textarea
      v-model="form.description"
      placeholder="Описание"
      rows="3"
      class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none bg-background"
    />

    <div class="flex flex-wrap gap-2">
      <!-- Due Date -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1">
            <CalendarIcon :size="16" />
            {{ form.dueDate ? formatDate(form.dueDate, 'MMM d') : 'Дата выполнения' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-auto p-0">
          <Calendar v-model="form.dueDate as any" />
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Deadline -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1">
            <Clock :size="16" />
            {{ form.deadline ? formatDate(form.deadline, 'MMM d, HH:mm') : 'Крайний срок' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-auto p-0">
          <div class="p-3 space-y-2">
            <Calendar v-model="form.deadline as any" />
            <div class="flex gap-2">
              <Input
                v-model="deadlineTime"
                type="time"
                placeholder="Время"
                class="w-full"
                @change="handleDeadlineTimeUpdate"
              />
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Priority -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1">
            <Flag
              :size="16"
              :class="form.priority && getPriorityColor(form.priority)"
            />
            {{ form.priority ? PRIORITY_LABELS[form.priority] : 'Приоритет' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <DropdownMenuItem
            v-for="p in priorities"
            :key="p"
            @click="form.priority = p"
          >
            <Flag :size="16" :class="['mr-2', getPriorityColor(p)]" />
            {{ PRIORITY_LABELS[p] }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Tags -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1">
            <Tag :size="16" />
            Теги {{ form.tags.length > 0 ? `(${form.tags.length})` : '' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-64">
          <div class="p-3 space-y-2">
            <div class="flex gap-2">
              <Input
                v-model="newTag"
                placeholder="Добавить тег"
                @keyup.enter="addTag"
              />
              <Button size="icon" variant="secondary" @click="addTag">
                <Plus :size="16" />
              </Button>
            </div>
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="tag in form.tags"
                :key="tag"
                variant="secondary"
                class="gap-1"
              >
                {{ tag }}
                <X :size="12" class="cursor-pointer" @click="removeTag(tag)" />
              </Badge>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Location -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="gap-1">
            <MapPin :size="16" />
            {{ form.location || 'Место' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-64">
          <div class="p-3">
            <Input
              v-model="form.location"
              placeholder="Введите место"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Pomodoro Switch -->
    <div class="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
      <div class="flex items-center gap-2">
        <Timer :size="16" class="text-red-600" />
        <label class="cursor-pointer text-sm font-medium">Помодоро</label>
      </div>
      <Switch v-model="form.isPomodoroTask" />
    </div>

    <!-- Pomodoro Settings -->
    <div
      v-if="form.isPomodoroTask"
      class="space-y-3 p-4 border border-border rounded-lg"
    >
      <div class="flex items-center gap-3">
        <label class="text-sm whitespace-nowrap font-medium">
          Количество раундов:
        </label>
        <Input
          v-model.number="form.pomodoroCount"
          type="number"
          :min="1"
          :max="10"
          class="w-24"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">
            Помодоро (мин)
          </label>
          <Input
            v-model.number="form.pomodoroDuration"
            type="number"
            :min="1"
            :max="60"
            class="w-full"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">
            Малый перерыв (мин)
          </label>
          <Input
            v-model.number="form.shortBreak"
            type="number"
            :min="1"
            :max="15"
            class="w-full"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">
            Большой перерыв (мин)
          </label>
          <Input
            v-model.number="form.longBreak"
            type="number"
            :min="5"
            :max="30"
            class="w-full"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">
            Большой перерыв после
          </label>
          <Input
            v-model.number="form.longBreakInterval"
            type="number"
            :min="2"
            :max="10"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <Button
      @click="handleSubmit"
      class="w-full"
      :disabled="!form.title.trim() || loading"
    >
      <span v-if="loading" class="flex items-center gap-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        Добавление...
      </span>
      <span v-else>Добавить задачу</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Tag,
  MapPin,
  Timer,
  X,
  Plus
} from 'lucide-vue-next'
import { type Priority, PRIORITY_LABELS } from '../model/constants'
import type { Task } from '../model/types'
import { formatDate } from '../lib/formatters'
import { getPriorityColor } from '../lib/priority'
import { updateDeadlineTime } from '../lib/dateTime'

interface TaskFormData extends Omit<Task, 'id' | 'completed' | 'pomodoroCompleted'> {
  tags: string[]
}

interface Props {
  loading?: boolean
}

interface Emits {
  (e: 'submit', task: Omit<Task, 'id' | 'completed' | 'pomodoroCompleted'>): void
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const form = reactive<TaskFormData>({
  title: '',
  description: '',
  dueDate: undefined,
  deadline: undefined,
  priority: undefined,
  tags: [],
  location: '',
  isPomodoroTask: false,
  pomodoroCount: 4,
  pomodoroDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4
})

const newTag = ref('')
const deadlineTime = ref('')

const priorities: Priority[] = ['high', 'medium', 'low']

const handleDeadlineTimeUpdate = () => {
  form.deadline = updateDeadlineTime(form.deadline, deadlineTime.value)
}

const addTag = () => {
  if (newTag.value.trim() && !form.tags.includes(newTag.value.trim())) {
    form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (tag: string) => {
  const index = form.tags.indexOf(tag)
  if (index > -1) {
    form.tags.splice(index, 1)
  }
}

const resetForm = () => {
  form.title = ''
  form.description = ''
  form.dueDate = undefined
  form.deadline = undefined
  form.priority = undefined
  form.tags = []
  form.location = ''
  form.isPomodoroTask = false
  form.pomodoroCount = 4
  form.pomodoroDuration = 25
  form.shortBreak = 5
  form.longBreak = 15
  form.longBreakInterval = 4
  deadlineTime.value = ''
}

const handleSubmit = () => {
  if (!form.title.trim()) return

  emit('submit', JSON.parse(JSON.stringify(form)) as Task)
}

defineExpose({
  resetForm
})
</script>

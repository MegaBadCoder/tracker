<template>
  <div class="bg-card rounded-xl border border-border overflow-hidden">
    <!-- Title -->
    <div class="px-4 pt-3" :class="expanded ? 'pb-2' : 'pb-3'">
      <Input
        ref="titleInputRef"
        v-model="form.title"
        placeholder="Название задачи"
        class="border-0 shadow-none px-0 text-lg font-semibold placeholder:font-normal focus-visible:ring-0"
        @focus="expanded = true"
        @keyup.enter="handleSubmit"
      />
    </div>

    <!-- Collapsible body -->
    <div
      class="grid transition-all duration-200 ease-out"
      :class="expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
    >
      <div class="overflow-hidden">

    <!-- Description -->
    <div class="px-5 pb-4">
      <Textarea
        v-model="form.description"
        placeholder="Добавить описание..."
        rows="2"
        class="border-0 shadow-none px-0 resize-none focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/60"
      />
    </div>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-1.5 px-5 pb-4">
      <!-- Due Date -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="['gap-1.5 cursor-pointer transition-colors duration-150', form.dueDate && 'text-primary border-primary/30 bg-primary/5']"
          >
            <CalendarIcon :size="14" />
            {{ form.dueDate ? formatDate(form.dueDate, 'MMM d') : 'Дата' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-auto p-0" align="start">
          <Calendar v-model="form.dueDate as any" />
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Deadline -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="['gap-1.5 cursor-pointer transition-colors duration-150', form.deadline && 'text-orange-600 border-orange-300/50 bg-orange-50 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-500/10']"
          >
            <Clock :size="14" />
            {{ form.deadline ? formatDate(form.deadline, 'MMM d, HH:mm') : 'Дедлайн' }}
          </Button>
        </DropdownMenuTrigger>
        <DeadlinePicker
          :model-value="form.deadline"
          @update:model-value="form.deadline = $event"
        />
      </DropdownMenu>

      <!-- Priority -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="['gap-1.5 cursor-pointer transition-colors duration-150', form.priority && getPriorityColor(form.priority)]"
          >
            <Flag :size="14" :class="form.priority && getPriorityColor(form.priority)" />
            {{ form.priority ? PRIORITY_LABELS[form.priority] : 'Приоритет' }}
          </Button>
        </DropdownMenuTrigger>
        <PriorityPicker
          :model-value="form.priority"
          @update:model-value="form.priority = $event"
        />
      </DropdownMenu>

      <!-- Tags -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="['gap-1.5 cursor-pointer transition-colors duration-150', form.tags.length > 0 && 'text-violet-600 border-violet-300/50 bg-violet-50 dark:text-violet-400 dark:border-violet-500/30 dark:bg-violet-500/10']"
          >
            <Tag :size="14" />
            {{ form.tags.length > 0 ? `Теги (${form.tags.length})` : 'Теги' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-64" align="start">
          <TagsEditor
            :model-value="form.tags"
            @update:model-value="form.tags = $event"
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Location -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="['gap-1.5 cursor-pointer transition-colors duration-150', form.location && 'text-emerald-600 border-emerald-300/50 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10']"
          >
            <MapPin :size="14" />
            {{ form.location || 'Место' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56" align="start">
          <div class="p-3">
            <Input
              v-model="form.location"
              placeholder="Введите место"
              class="h-8 text-sm"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Pomodoro Section -->
    <div class="border-t border-border px-5 py-3">
      <div
        class="flex items-center justify-between cursor-pointer select-none"
        @click="form.isPomodoroTask = !form.isPomodoroTask"
      >
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center w-7 h-7 rounded-md bg-red-50 dark:bg-red-500/10">
            <Timer :size="14" class="text-red-500" />
          </div>
          <span class="text-sm font-medium">Помодоро</span>
        </div>
        <Switch
          :checked="form.isPomodoroTask"
          @update:checked="form.isPomodoroTask = $event"
          @click.stop
        />
      </div>

      <!-- Pomodoro Settings -->
      <div
        v-if="form.isPomodoroTask"
        class="mt-3 animate-in fade-in slide-in-from-top-1 duration-200"
      >
        <PomodoroSettings
          :count="form.pomodoroCount"
          :duration="form.pomodoroDuration"
          :short-break="form.shortBreak"
          :long-break="form.longBreak"
          :long-break-interval="form.longBreakInterval"
          @update:count="form.pomodoroCount = $event"
          @update:duration="form.pomodoroDuration = $event"
          @update:short-break="form.shortBreak = $event"
          @update:long-break="form.longBreak = $event"
          @update:long-break-interval="form.longBreakInterval = $event"
        />
      </div>
    </div>

    <!-- Submit -->
    <div class="border-t border-border px-4 py-2.5 flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        class="cursor-pointer transition-all duration-150"
        @click="handleCancel"
      >
        Отмена
      </Button>
      <Button
        size="sm"
        class="cursor-pointer transition-all duration-150"
        :disabled="!form.title.trim() || loading"
        @click="handleSubmit"
      >
        <div v-if="loading" class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent mr-1.5" />
        {{ loading ? 'Добавление...' : 'Добавить задачу' }}
      </Button>
    </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, toRaw, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Tag,
  MapPin,
  Timer,
} from 'lucide-vue-next'
import { PRIORITY_LABELS, POMODORO_DEFAULTS } from '../model/constants'
import type { Task } from '../model/types'
import { formatDate } from '../lib/formatters'
import { getPriorityColor } from '../lib/priority'
import TagsEditor from './TagsEditor.vue'
import PriorityPicker from './PriorityPicker.vue'
import DeadlinePicker from './DeadlinePicker.vue'
import PomodoroSettings from './PomodoroSettings.vue'

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
  pomodoroCount: POMODORO_DEFAULTS.count,
  pomodoroDuration: POMODORO_DEFAULTS.duration,
  shortBreak: POMODORO_DEFAULTS.shortBreak,
  longBreak: POMODORO_DEFAULTS.longBreak,
  longBreakInterval: POMODORO_DEFAULTS.longBreakInterval,
})

const expanded = ref(false)
const titleInputRef = ref<InstanceType<typeof Input> | null>(null)

const resetForm = () => {
  form.title = ''
  form.description = ''
  form.dueDate = undefined
  form.deadline = undefined
  form.priority = undefined
  form.tags = []
  form.location = ''
  form.isPomodoroTask = false
  form.pomodoroCount = POMODORO_DEFAULTS.count
  form.pomodoroDuration = POMODORO_DEFAULTS.duration
  form.shortBreak = POMODORO_DEFAULTS.shortBreak
  form.longBreak = POMODORO_DEFAULTS.longBreak
  form.longBreakInterval = POMODORO_DEFAULTS.longBreakInterval
}

const handleCancel = () => {
  expanded.value = false
  resetForm()
  const input = titleInputRef.value?.$el as HTMLInputElement | undefined
  input?.blur()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && expanded.value) {
    handleCancel()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

const handleSubmit = () => {
  if (!form.title.trim()) return
  emit('submit', structuredClone(toRaw(form)) as Task)
}

defineExpose({
  resetForm
})
</script>

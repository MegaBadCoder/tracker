<template>
  <div class="max-w-lg mx-auto px-4 py-8 space-y-6">
    <h1 class="text-lg font-semibold">Настройки</h1>

    <!-- Timezone -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Часовой пояс</label>
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          :placeholder="currentLabel"
          @focus="dropdownOpen = true"
        />
        <div
          v-if="dropdownOpen"
          class="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
        >
          <button
            v-for="tz in filteredTimezones"
            :key="tz.value"
            :class="[
              'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
              tz.value === selectedTimezone && 'bg-accent font-medium',
            ]"
            @click="selectTimezone(tz.value)"
          >
            {{ tz.label }}
          </button>
          <div v-if="filteredTimezones.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
            Не найдено
          </div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        Влияет на вычисление дат повторяющихся задач и отображение в календаре.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user-store'

const userStore = useUserStore()

const POPULAR_TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2/+3)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'Asia/Kolkata', label: 'Индия (UTC+5:30)' },
  { value: 'Asia/Bangkok', label: 'Бангкок (UTC+7)' },
  { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Чикаго (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Денвер (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8/-7)' },
]

const selectedTimezone = ref(userStore.timezone)
const searchQuery = ref('')
const dropdownOpen = ref(false)

const currentLabel = computed(() => {
  const found = POPULAR_TIMEZONES.find((tz) => tz.value === selectedTimezone.value)
  return found ? found.label : selectedTimezone.value
})

const filteredTimezones = computed(() => {
  if (!searchQuery.value) return POPULAR_TIMEZONES
  const q = searchQuery.value.toLowerCase()
  return POPULAR_TIMEZONES.filter(
    (tz) => tz.label.toLowerCase().includes(q) || tz.value.toLowerCase().includes(q),
  )
})

async function selectTimezone(tz: string) {
  selectedTimezone.value = tz
  searchQuery.value = ''
  dropdownOpen.value = false
  await userStore.updateTimezone(tz)
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) {
    dropdownOpen.value = false
    searchQuery.value = ''
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  userStore.fetchMe()
})
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-8 space-y-8">
    <h1 class="text-lg font-semibold">Настройки</h1>

    <!-- Email & Password -->
    <div class="space-y-4">
      <h2 class="text-sm font-medium text-foreground">Email и пароль</h2>

      <!-- Link email (Telegram-only users) -->
      <template v-if="!userStore.user?.hasEmailAuth">
        <form class="space-y-3" @submit.prevent="handleLinkEmail">
          <Input
            v-model="linkEmailForm.email"
            type="email"
            placeholder="Email"
            required
          />
          <Input
            v-model="linkEmailForm.password"
            type="password"
            placeholder="Пароль"
            required
            :minlength="6"
            autocomplete="new-password"
          />
          <Input
            v-model="linkEmailForm.confirmPassword"
            type="password"
            placeholder="Подтвердите пароль"
            required
            :minlength="6"
            autocomplete="new-password"
          />
          <p v-if="linkEmailError" class="text-sm text-destructive">{{ linkEmailError }}</p>
          <p v-if="linkEmailSuccess" class="text-sm text-emerald-600">{{ linkEmailSuccess }}</p>
          <Button type="submit" :disabled="linkEmailLoading" class="w-full">
            {{ linkEmailLoading ? '...' : 'Привязать email' }}
          </Button>
        </form>
      </template>

      <!-- Email linked — show email + change password -->
      <template v-else>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">Email:</span>
          <span>{{ userStore.user?.email }}</span>
          <span class="text-emerald-600">&#10003;</span>
        </div>

        <form class="space-y-3" @submit.prevent="handleChangePassword">
          <Input
            v-model="changePassForm.oldPassword"
            type="password"
            placeholder="Текущий пароль"
            required
            autocomplete="current-password"
          />
          <Input
            v-model="changePassForm.newPassword"
            type="password"
            placeholder="Новый пароль"
            required
            :minlength="6"
            autocomplete="new-password"
          />
          <Input
            v-model="changePassForm.confirmPassword"
            type="password"
            placeholder="Подтвердите новый пароль"
            required
            :minlength="6"
            autocomplete="new-password"
          />
          <p v-if="changePassError" class="text-sm text-destructive">{{ changePassError }}</p>
          <p v-if="changePassSuccess" class="text-sm text-emerald-600">{{ changePassSuccess }}</p>
          <Button type="submit" :disabled="changePassLoading" class="w-full">
            {{ changePassLoading ? '...' : 'Изменить пароль' }}
          </Button>
        </form>
      </template>
    </div>

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

    <!-- Calendar language -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Язык календаря</label>
      <div class="flex gap-2">
        <button
          v-for="opt in LANGUAGE_OPTIONS"
          :key="opt.value"
          type="button"
          :class="[
            'flex-1 h-10 px-3 rounded-md border text-sm transition-colors',
            userStore.language === opt.value
              ? 'border-primary bg-accent font-medium'
              : 'border-border hover:bg-accent',
          ]"
          @click="selectLanguage(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        Язык названий месяцев и дней недели в календарях и датах.
      </p>
    </div>

    <!-- First day of week -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Первый день недели</label>
      <div class="flex gap-2">
        <button
          v-for="opt in FIRST_DAY_OPTIONS"
          :key="opt.value"
          type="button"
          :class="[
            'flex-1 h-10 px-3 rounded-md border text-sm transition-colors',
            userStore.firstDayOfWeek === opt.value
              ? 'border-primary bg-accent font-medium'
              : 'border-border hover:bg-accent',
          ]"
          @click="selectFirstDayOfWeek(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        С какого дня начинается неделя в календарях.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user-store'
import { linkEmail, changePassword } from '@/api/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const userStore = useUserStore()
const router = useRouter()

// ── Link email form ──
const linkEmailForm = reactive({ email: '', password: '', confirmPassword: '' })
const linkEmailError = ref<string | null>(null)
const linkEmailSuccess = ref<string | null>(null)
const linkEmailLoading = ref(false)

async function handleLinkEmail() {
  linkEmailError.value = null
  linkEmailSuccess.value = null

  if (linkEmailForm.password !== linkEmailForm.confirmPassword) {
    linkEmailError.value = 'Пароли не совпадают'
    return
  }

  linkEmailLoading.value = true
  try {
    const result = await linkEmail(
      linkEmailForm.email,
      linkEmailForm.password,
      linkEmailForm.confirmPassword,
    )
    router.push({ name: 'verify-email', query: { email: result.email } })
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 409) {
      linkEmailError.value = 'Этот email уже используется'
    } else {
      linkEmailError.value = 'Ошибка привязки email'
    }
  } finally {
    linkEmailLoading.value = false
  }
}

// ── Change password form ──
const changePassForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const changePassError = ref<string | null>(null)
const changePassSuccess = ref<string | null>(null)
const changePassLoading = ref(false)

async function handleChangePassword() {
  changePassError.value = null
  changePassSuccess.value = null

  if (changePassForm.newPassword !== changePassForm.confirmPassword) {
    changePassError.value = 'Пароли не совпадают'
    return
  }

  changePassLoading.value = true
  try {
    await changePassword(
      changePassForm.oldPassword,
      changePassForm.newPassword,
      changePassForm.confirmPassword,
    )
    changePassSuccess.value = 'Пароль изменён'
    changePassForm.oldPassword = ''
    changePassForm.newPassword = ''
    changePassForm.confirmPassword = ''
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 401) {
      changePassError.value = 'Неверный текущий пароль'
    } else {
      changePassError.value = 'Ошибка смены пароля'
    }
  } finally {
    changePassLoading.value = false
  }
}

// ── Timezone ──
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

// Текущее UTC-смещение зоны (учитывает DST на момент открытия), напр. "UTC-3".
function offsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    const gmt = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    return gmt.replace('GMT', 'UTC') || 'UTC'
  } catch {
    return ''
  }
}

// Полный список IANA-зон из рантайма (ICU/IANA tz database). Без сторонних библиотек.
const ALL_TIMEZONES = computed(() => {
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf
  const zones = typeof supportedValuesOf === 'function' ? supportedValuesOf('timeZone') : []
  return zones.map((value) => ({ value, label: `${value} (${offsetLabel(value)})` }))
})

const selectedTimezone = ref(userStore.timezone)
const searchQuery = ref('')
const dropdownOpen = ref(false)

const currentLabel = computed(() => {
  const found = POPULAR_TIMEZONES.find((tz) => tz.value === selectedTimezone.value)
  if (found) return found.label
  const off = offsetLabel(selectedTimezone.value)
  return off ? `${selectedTimezone.value} (${off})` : selectedTimezone.value
})

const filteredTimezones = computed(() => {
  if (!searchQuery.value) return POPULAR_TIMEZONES
  const q = searchQuery.value.toLowerCase()
  const match = (tz: { value: string; label: string }) =>
    tz.label.toLowerCase().includes(q) || tz.value.toLowerCase().includes(q)
  const popular = POPULAR_TIMEZONES.filter(match)
  const seen = new Set(popular.map((tz) => tz.value))
  const rest = ALL_TIMEZONES.value.filter((tz) => !seen.has(tz.value) && match(tz))
  return [...popular, ...rest]
})

async function selectTimezone(tz: string) {
  selectedTimezone.value = tz
  searchQuery.value = ''
  dropdownOpen.value = false
  await userStore.updateTimezone(tz)
}

// ── Calendar language & first day of week ──
const LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]
const FIRST_DAY_OPTIONS = [
  { value: 1, label: 'Понедельник' },
  { value: 0, label: 'Воскресенье' },
]

async function selectLanguage(lang: string) {
  await userStore.updateLanguage(lang)
}

async function selectFirstDayOfWeek(day: number) {
  await userStore.updateFirstDayOfWeek(day)
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

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authorize, authorizeWithWidget, loginWithEmail, register } from '../api/auth'
import { useUserStore } from '@/stores/user-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const router = useRouter()
const userStore = useUserStore()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const widgetContainer = ref<HTMLDivElement>()

const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME || 'AlfyTrackerBot').replace(/^@/, '')

async function handleEmailSubmit() {
  error.value = null
  loading.value = true
  try {
    if (mode.value === 'register') {
      if (password.value !== confirmPassword.value) {
        error.value = 'Пароли не совпадают'
        loading.value = false
        return
      }
      const result = await register(email.value, password.value, confirmPassword.value, firstName.value, lastName.value || undefined)
      router.push({ name: 'verify-email', query: { email: result.email } })
      return
    }
    await loginWithEmail(email.value, password.value)
    await userStore.fetchMe()
    router.replace('/')
  } catch (err: any) {
    const status = err?.response?.status
    const msg = err?.response?.data?.message
    if (mode.value === 'register' && status === 409) {
      error.value = 'Этот email уже зарегистрирован'
    } else if (mode.value === 'login' && status === 401 && msg === 'Email not verified') {
      router.push({ name: 'verify-email', query: { email: email.value } })
      return
    } else if (mode.value === 'login' && status === 401) {
      error.value = 'Неверный email или пароль'
    } else {
      error.value = 'Ошибка авторизации'
    }
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = null
}

onMounted(async () => {
  const tg = window.Telegram?.WebApp

  if (tg?.initData) {
    try {
      tg.ready()
      const { user } = await authorize()
      if (user) userStore.setUser(user)
      await userStore.fetchMe()
      router.replace('/')
      return
    } catch {
      error.value = 'Ошибка авторизации через WebApp'
    }
  }

  window.onTelegramAuth = async (tgUser: TelegramLoginWidgetUser) => {
    try {
      const { user } = await authorizeWithWidget(tgUser)
      if (user) userStore.setUser(user)
      await userStore.fetchMe()
      router.replace('/')
    } catch {
      error.value = 'Ошибка авторизации'
    }
  }

  const script = document.createElement('script')
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', BOT_USERNAME)
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')
  script.setAttribute('data-request-access', 'write')
  script.async = true

  widgetContainer.value?.appendChild(script)
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">Alfy</h1>
        <p class="text-sm text-muted-foreground">
          {{ mode === 'login' ? 'Войдите в аккаунт' : 'Создайте аккаунт' }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleEmailSubmit">
        <template v-if="mode === 'register'">
          <div class="space-y-2">
            <Input
              v-model="firstName"
              type="text"
              placeholder="Имя"
              required
              autocomplete="given-name"
            />
          </div>
          <div class="space-y-2">
            <Input
              v-model="lastName"
              type="text"
              placeholder="Фамилия"
              autocomplete="family-name"
            />
          </div>
        </template>

        <div class="space-y-2">
          <Input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            autocomplete="email"
          />
        </div>

        <div class="space-y-2">
          <Input
            v-model="password"
            type="password"
            placeholder="Пароль"
            required
            :minlength="6"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          />
        </div>

        <div v-if="mode === 'register'" class="space-y-2">
          <Input
            v-model="confirmPassword"
            type="password"
            placeholder="Подтвердите пароль"
            required
            :minlength="6"
            autocomplete="new-password"
          />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" class="w-full" :disabled="loading">
          {{ loading ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться' }}
        </Button>

        <div v-if="mode === 'login'" class="text-right">
          <button
            type="button"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            @click="router.push('/reset-password')"
          >
            Забыли пароль?
          </button>
        </div>
      </form>

      <div class="text-center">
        <button
          type="button"
          class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="toggleMode"
        >
          {{ mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти' }}
        </button>
      </div>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      <div ref="widgetContainer" class="flex justify-center" />
    </div>
  </div>
</template>

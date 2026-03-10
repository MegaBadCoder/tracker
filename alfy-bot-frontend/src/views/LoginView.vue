<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authorize, authorizeWithWidget } from '../api/auth'

const router = useRouter()
const error = ref<string | null>(null)
const widgetContainer = ref<HTMLDivElement>()

const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME || 'AlfyTrackerBot').replace(/^@/, '')

onMounted(async () => {
  const tg = window.Telegram?.WebApp

  if (tg?.initData) {
    try {
      tg.ready()
      await authorize()
      router.replace('/')
      return
    } catch {
      error.value = 'Ошибка авторизации через WebApp'
    }
  }

  window.onTelegramAuth = async (user: TelegramLoginWidgetUser) => {
    try {
      await authorizeWithWidget(user)
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
  <div class="login-page">
    <h1>Alfy</h1>
    123123
    <p>Войдите через Telegram, чтобы продолжить123123</p>
    <div ref="widgetContainer" class="widget-container" />
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}

.widget-container {
  margin-top: 1rem;
}

.error {
  color: var(--destructive, #ef4444);
}
</style>

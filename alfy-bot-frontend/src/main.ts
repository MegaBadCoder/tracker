import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'
import { authorize } from './api/auth'
import { useUserStore } from './stores/user-store'
import { initPushSubscription } from './composables/usePushSubscription'
import App from './App.vue'
import router from './router'
import './style.css'

registerSW({ immediate: true })

const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID
const DEV_USE_WIDGET = import.meta.env.VITE_DEV_USE_WIDGET === 'true'

const pinia = createPinia()

async function bootstrap() {
  const app = createApp(App)
  app.use(pinia)
  app.use(router)

  const tg = window.Telegram?.WebApp

  if (tg?.initData) {
    tg.ready()
    const { user } = await authorize()
    if (user) useUserStore().setUser(user)
  }
  else if (DEV_TELEGRAM_ID && !DEV_USE_WIDGET) {
    const { user } = await authorize()
    if (user) useUserStore().setUser(user)
  }

  app.mount('#app')

  initPushSubscription().catch(() => {})
}

bootstrap()

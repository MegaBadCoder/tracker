import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { authorize } from './api/auth'
import router from './router'
import './style.css'

const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID
const DEV_USE_WIDGET = import.meta.env.VITE_DEV_USE_WIDGET === 'true'

async function bootstrap() {
  const tg = window.Telegram?.WebApp

  if (tg?.initData) {
    tg.ready()
    await authorize()
  } else if (DEV_TELEGRAM_ID && !DEV_USE_WIDGET) {
    await authorize()
  }

  createApp(App).use(createPinia()).use(router).mount('#app')
}

bootstrap()

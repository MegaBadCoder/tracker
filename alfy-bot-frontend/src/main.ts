import { createApp } from 'vue'
import App from './App.vue'
import { authorize } from './api/auth'
import router from './router'
import './style.css'

const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID

async function bootstrap() {
  const tg = window.Telegram?.WebApp

  if (tg?.initData) {
    // Telegram WebApp — auto-authorize before mounting
    tg.ready()
    await authorize()
  } else if (DEV_TELEGRAM_ID) {
    // Dev mode — authorize with dev telegram id
    await authorize()
  }

  createApp(App).use(router).mount('#app')
}

bootstrap()

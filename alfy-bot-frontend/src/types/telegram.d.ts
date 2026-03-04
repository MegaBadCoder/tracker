interface TelegramWebApp {
  ready(): void
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
  }
}

interface TelegramLoginWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
  onTelegramAuth?: (user: TelegramLoginWidgetUser) => void
}

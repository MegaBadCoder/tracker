import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'
const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID
  ? Number(import.meta.env.VITE_DEV_TELEGRAM_ID)
  : undefined
const DEV_USE_WIDGET = import.meta.env.VITE_DEV_USE_WIDGET === 'true'

const TOKEN_KEY = 'access_token'

let _token: string | null = null

export function getToken(): string | null {
  if (_token) return _token
  _token = localStorage.getItem(TOKEN_KEY)
  return _token
}

function saveToken(token: string) {
  _token = token
  localStorage.setItem(TOKEN_KEY, token)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function authorize(): Promise<string> {
  const tg = window.Telegram?.WebApp
  const isProd = tg && tg.initData

  const useDevId = !DEV_USE_WIDGET && DEV_TELEGRAM_ID
  const body = isProd
    ? { initData: tg.initData }
    : useDevId
      ? { devTelegramId: DEV_TELEGRAM_ID }
      : null

  if (!body) {
    throw new Error('No auth credentials. Use Login Widget or set VITE_DEV_TELEGRAM_ID with VITE_DEV_USE_WIDGET=false')
  }

  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/telegram`,
    body,
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return data.accessToken
}

export async function authorizeWithWidget(user: TelegramLoginWidgetUser): Promise<string> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/telegram`,
    user,
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return data.accessToken
}

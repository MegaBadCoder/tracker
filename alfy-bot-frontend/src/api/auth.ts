import axios from 'axios'
import type { UserProfile } from '@/types/user'

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

export function clearToken(): void {
  _token = null
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export interface AuthResult {
  accessToken: string
  user: UserProfile | null
}

export async function authorize(): Promise<AuthResult> {
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

  const tgUser = tg?.initDataUnsafe?.user
  const user: UserProfile | null = tgUser
    ? { firstName: tgUser.first_name, lastName: tgUser.last_name }
    : useDevId
      ? { firstName: 'Dev' }
      : null

  return { accessToken: data.accessToken, user }
}

export async function authorizeWithWidget(user: TelegramLoginWidgetUser): Promise<AuthResult> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/telegram`,
    user,
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)

  return {
    accessToken: data.accessToken,
    user: {
      firstName: user.first_name,
      lastName: user.last_name,
      photoUrl: user.photo_url,
    },
  }
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/login`,
    { email, password },
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return { accessToken: data.accessToken, user: null }
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName?: string,
): Promise<AuthResult> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/register`,
    { email, password, firstName, lastName },
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return { accessToken: data.accessToken, user: null }
}

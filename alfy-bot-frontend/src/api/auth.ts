import axios from 'axios'
import type { UserProfile } from '@/types/user'
import { saveToken } from './tokenStorage'
import { api } from './client'

export { getToken, clearToken, isAuthenticated } from './tokenStorage'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'
const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID
  ? Number(import.meta.env.VITE_DEV_TELEGRAM_ID)
  : undefined
const DEV_USE_WIDGET = import.meta.env.VITE_DEV_USE_WIDGET === 'true'

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
  confirmPassword: string,
  firstName: string,
  lastName?: string,
): Promise<{ message: string; email: string }> {
  const { data } = await axios.post<{ message: string; email: string }>(
    `${BASE_URL}/auth/register`,
    { email, password, confirmPassword, firstName, lastName },
    { headers: { 'Content-Type': 'application/json' } },
  )

  return data
}

export async function verifyEmail(email: string, code: string): Promise<AuthResult> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/verify-email`,
    { email, code },
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return { accessToken: data.accessToken, user: null }
}

export async function resendCode(email: string): Promise<void> {
  await axios.post(
    `${BASE_URL}/auth/resend-code`,
    { email },
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export async function forgotPassword(email: string): Promise<void> {
  await axios.post(
    `${BASE_URL}/auth/forgot-password`,
    { email },
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
  confirmPassword: string,
): Promise<AuthResult> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/reset-password`,
    { email, code, newPassword, confirmPassword },
    { headers: { 'Content-Type': 'application/json' } },
  )

  saveToken(data.accessToken)
  return { accessToken: data.accessToken, user: null }
}

// Authenticated API calls (use api client with Bearer token)
export async function linkEmail(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<{ message: string; email: string }> {
  const { data } = await api.post<{ message: string; email: string }>(
    '/auth/link-email',
    { email, password, confirmPassword },
  )
  return data
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await api.post('/auth/change-password', {
    oldPassword,
    newPassword,
    confirmPassword,
  })
}

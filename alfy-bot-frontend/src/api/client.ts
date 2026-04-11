import axios from 'axios'
import { clearToken, getToken } from './auth'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// On 401 — clear auth state and redirect to login
api.interceptors.response.use(
  r => r,
  async (error) => {
    if (error.response?.status === 401) {
      clearToken()
      localStorage.removeItem('user_profile')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

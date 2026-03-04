import axios from 'axios'
import { authorize, getToken } from './auth'

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

// On 401 — re-authorize and retry once
api.interceptors.response.use(
  r => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const token = await authorize()
      original.headers['Authorization'] = `Bearer ${token}`
      return api.request(original)
    }
    return Promise.reject(error)
  },
)

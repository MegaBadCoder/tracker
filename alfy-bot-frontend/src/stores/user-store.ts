import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { UserProfile } from '@/types/user'

const USER_KEY = 'user_profile'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserProfile | null>(null)

  const initials = computed(() => {
    if (!user.value) return '?'
    const first = user.value.firstName?.charAt(0) ?? ''
    const last = user.value.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || '?'
  })

  const displayName = computed(() => {
    if (!user.value) return ''
    return [user.value.firstName, user.value.lastName].filter(Boolean).join(' ')
  })

  const timezone = computed(() => user.value?.timezone ?? 'UTC')

  function setUser(profile: UserProfile) {
    user.value = profile
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
  }

  function loadUser() {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      try {
        user.value = JSON.parse(raw)
      } catch {
        user.value = null
      }
    }
  }

  function clearUser() {
    user.value = null
    localStorage.removeItem(USER_KEY)
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me')
      if (data && user.value) {
        user.value.timezone = data.timezone ?? 'UTC'
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      }
    } catch {
      // ignore — user profile stays from login
    }
  }

  async function updateTimezone(tz: string) {
    try {
      await api.patch('/auth/timezone', { timezone: tz })
      if (user.value) {
        user.value.timezone = tz
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      }
    } catch (err) {
      console.error('Failed to update timezone:', err)
      throw err
    }
  }

  // Load persisted data on store creation
  loadUser()

  return {
    user,
    initials,
    displayName,
    timezone,
    setUser,
    loadUser,
    clearUser,
    fetchMe,
    updateTimezone,
  }
})

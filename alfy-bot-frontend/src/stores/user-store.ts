import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { clearToken } from '@/api/tokenStorage'
import { setLocalePrefs } from '@/composables/useLocale'
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
  const language = computed(() => user.value?.language ?? 'ru')
  const firstDayOfWeek = computed(() => user.value?.firstDayOfWeek ?? 1)

  function setUser(profile: UserProfile) {
    user.value = profile
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    setLocalePrefs({ language: profile.language, firstDayOfWeek: profile.firstDayOfWeek })
  }

  function loadUser() {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      try {
        user.value = JSON.parse(raw)
        if (user.value) {
          setLocalePrefs({
            language: user.value.language,
            firstDayOfWeek: user.value.firstDayOfWeek,
          })
        }
      } catch {
        user.value = null
      }
    }
  }

  function clearUser() {
    user.value = null
    localStorage.removeItem(USER_KEY)
  }

  function logout() {
    clearUser()
    clearToken()
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me')
      if (data) {
        setUser({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          photoUrl: data.photoUrl,
          phone: data.phone,
          timezone: data.timezone ?? 'UTC',
          language: data.language ?? 'ru',
          firstDayOfWeek: data.firstDayOfWeek ?? 1,
          hasEmailAuth: data.hasEmailAuth ?? false,
        })
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

  async function updateLanguage(lang: string) {
    try {
      await api.patch('/auth/language', { language: lang })
      if (user.value) {
        user.value.language = lang
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      }
      setLocalePrefs({ language: lang })
    } catch (err) {
      console.error('Failed to update language:', err)
      throw err
    }
  }

  async function updateFirstDayOfWeek(day: number) {
    try {
      await api.patch('/auth/first-day-of-week', { firstDayOfWeek: day })
      if (user.value) {
        user.value.firstDayOfWeek = day
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      }
      setLocalePrefs({ firstDayOfWeek: day })
    } catch (err) {
      console.error('Failed to update first day of week:', err)
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
    language,
    firstDayOfWeek,
    setUser,
    loadUser,
    clearUser,
    logout,
    fetchMe,
    updateTimezone,
    updateLanguage,
    updateFirstDayOfWeek,
  }
})

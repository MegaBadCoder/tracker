<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { forgotPassword, resetPassword } from '../api/auth'
import { useUserStore } from '@/stores/user-store'
import { useCooldown } from '@/composables/useCooldown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { cooldown, start: startCooldown } = useCooldown(60)

const step = ref<'email' | 'code'>((route.query.email as string) ? 'code' : 'email')
const email = ref((route.query.email as string) || '')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSendCode() {
  if (!email.value) return
  error.value = null
  loading.value = true
  try {
    await forgotPassword(email.value)
    step.value = 'code'
    startCooldown()
  } catch {
    error.value = 'Ошибка отправки кода'
  } finally {
    loading.value = false
  }
}

async function handleReset() {
  error.value = null
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  if (code.value.length !== 6) return

  loading.value = true
  try {
    await resetPassword(email.value, code.value, newPassword.value, confirmPassword.value)
    await userStore.fetchMe()
    router.replace('/')
  } catch (err: any) {
    const msg = err?.response?.data?.message
    if (msg === 'Code expired') {
      error.value = 'Код истёк. Запросите новый.'
    } else if (msg === 'Invalid code') {
      error.value = 'Неверный код'
    } else {
      error.value = 'Ошибка сброса пароля'
    }
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (cooldown.value > 0) return
  error.value = null
  try {
    await forgotPassword(email.value)
    startCooldown()
  } catch {
    error.value = 'Не удалось отправить код'
  }
}

onMounted(() => {
  if (route.query.email) startCooldown()
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">Восстановление пароля</h1>
        <p class="text-sm text-muted-foreground">
          {{ step === 'email' ? 'Введите email для получения кода' : `Код отправлен на ${email}` }}
        </p>
      </div>

      <!-- Step 1: Enter email -->
      <form v-if="step === 'email'" class="space-y-4" @submit.prevent="handleSendCode">
        <Input
          v-model="email"
          type="email"
          placeholder="Email"
          required
          autofocus
        />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="w-full" :disabled="loading">
          {{ loading ? '...' : 'Отправить код' }}
        </Button>
      </form>

      <!-- Step 2: Enter code + new password -->
      <form v-else class="space-y-4" @submit.prevent="handleReset">
        <Input
          v-model="code"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
          class="text-center text-2xl tracking-[0.5em] font-mono"
          required
          autofocus
        />
        <Input
          v-model="newPassword"
          type="password"
          placeholder="Новый пароль"
          required
          :minlength="6"
          autocomplete="new-password"
        />
        <Input
          v-model="confirmPassword"
          type="password"
          placeholder="Подтвердите пароль"
          required
          :minlength="6"
          autocomplete="new-password"
        />

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" class="w-full" :disabled="loading || code.length !== 6">
          {{ loading ? '...' : 'Сбросить пароль' }}
        </Button>

        <div class="text-center">
          <button
            type="button"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            :disabled="cooldown > 0"
            @click="handleResend"
          >
            {{ cooldown > 0 ? `Отправить повторно (${cooldown}с)` : 'Отправить код повторно' }}
          </button>
        </div>
      </form>

      <div class="text-center">
        <button
          type="button"
          class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="router.push('/login')"
        >
          Назад к входу
        </button>
      </div>
    </div>
  </div>
</template>

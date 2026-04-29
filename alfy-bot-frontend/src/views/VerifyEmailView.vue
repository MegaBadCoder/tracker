<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { verifyEmail, resendCode } from '../api/auth'
import { useUserStore } from '@/stores/user-store'
import { useCooldown } from '@/composables/useCooldown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { cooldown, start: startCooldown } = useCooldown(60)

const email = ref((route.query.email as string) || '')
const code = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleVerify() {
  if (code.value.length !== 6) return
  error.value = null
  loading.value = true
  try {
    await verifyEmail(email.value, code.value)
    await userStore.fetchMe()
    router.replace('/')
  } catch (err: any) {
    const msg = err?.response?.data?.message
    if (msg === 'Code expired') {
      error.value = 'Код истёк. Запросите новый.'
    } else if (msg === 'Invalid code') {
      error.value = 'Неверный код'
    } else {
      error.value = 'Ошибка подтверждения'
    }
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (cooldown.value > 0) return
  error.value = null
  try {
    await resendCode(email.value)
    startCooldown()
  } catch {
    error.value = 'Не удалось отправить код'
  }
}

onMounted(() => {
  if (!email.value) {
    router.replace('/login')
  }
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">Подтверждение email</h1>
        <p class="text-sm text-muted-foreground">
          Код отправлен на {{ email }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleVerify">
        <Input
          v-model="code"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
          class="text-center text-2xl tracking-[0.5em] font-mono"
          required
          autofocus
        />

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" class="w-full" :disabled="loading || code.length !== 6">
          {{ loading ? '...' : 'Подтвердить' }}
        </Button>
      </form>

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

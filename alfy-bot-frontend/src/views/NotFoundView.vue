<script setup lang="ts">
import { Home } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 text-center">
    <p class="text-8xl font-black text-muted select-none mb-4">404</p>
    <h1 class="text-2xl font-bold text-foreground mb-2">Страница не найдена</h1>
    <p class="text-muted-foreground mb-8">Запрошенная страница не существует или была удалена</p>
    <Button @click="router.push('/')">
      <Home class="w-4 h-4" />
      Вернуться на главную
    </Button>
  </div>
</template>

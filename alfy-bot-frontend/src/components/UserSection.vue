<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, LogOut, Monitor, Moon, Sun } from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUserStore } from '@/stores/user-store'
import { useTheme, type Theme } from '@/composables/useTheme'
import type { NavLink } from '@/types/navigation'

const props = defineProps<{
  links: NavLink[]
}>()

const AVATAR_COLORS = [
  'bg-red-500/15 text-red-700 dark:text-red-400',
  'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  'bg-pink-500/15 text-pink-700 dark:text-pink-400',
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const { theme, setTheme } = useTheme()

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
]

const avatarColorClass = hashColor(userStore.displayName || 'User')

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function navigate(to: string) {
  router.push(to)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground"
      >
        <Avatar class="h-8 w-8">
          <AvatarImage v-if="userStore.user?.photoUrl" :src="userStore.user.photoUrl" />
          <AvatarFallback :class="avatarColorClass">
            {{ userStore.initials }}
          </AvatarFallback>
        </Avatar>
        <span class="flex-1 truncate text-left">{{ userStore.displayName }}</span>
        <ChevronDown class="h-4 w-4 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" :side-offset="8" class="w-48">
      <DropdownMenuItem
        v-for="link in props.links"
        :key="link.to"
        :class="isActive(link.to) ? 'bg-accent' : ''"
        @click="navigate(link.to)"
      >
        <component :is="link.icon" class="h-4 w-4" />
        {{ link.label }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Тема
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="theme" @update:model-value="(v) => setTheme(v as Theme)">
        <DropdownMenuRadioItem
          v-for="opt in THEME_OPTIONS"
          :key="opt.value"
          :value="opt.value"
          class="min-h-11 sm:min-h-0 cursor-pointer"
        >
          <component :is="opt.icon" class="h-4 w-4" />
          {{ opt.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="handleLogout">
        <LogOut class="h-4 w-4" />
        Выйти
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<template>
  <AlertDialog :open="isOpen">
    <AlertDialogContent @escapeKeyDown="handleCancel" @pointerDownOutside="handleCancel">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options?.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ options?.message }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <label
        v-if="options?.rememberKey"
        class="flex items-center gap-2 px-1 text-sm"
      >
        <Checkbox
          :model-value="rememberChecked"
          @update:model-value="(v) => (rememberChecked = v === true)"
        />
        {{ options.rememberLabel }}
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ options?.cancelText || 'Отмена' }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="handleConfirm"
          :class="options?.variant === 'destructive' ? 'bg-destructive text-white hover:bg-destructive/90' : ''"
        >
          {{ options?.confirmText || 'Подтвердить' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const { isOpen, options, handleConfirm, handleCancel, rememberChecked } = useConfirm()
</script>

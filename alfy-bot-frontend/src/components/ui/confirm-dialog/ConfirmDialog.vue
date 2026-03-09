<template>
  <AlertDialog :open="isOpen">
    <AlertDialogContent @escapeKeyDown="handleCancel" @pointerDownOutside="handleCancel">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options?.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ options?.message }}
        </AlertDialogDescription>
      </AlertDialogHeader>
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

const { isOpen, options, handleConfirm, handleCancel } = useConfirm()
</script>

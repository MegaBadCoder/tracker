<script setup lang="ts">
import { ref, watch, nextTick, type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  editable?: boolean
  multiline?: boolean
  inline?: boolean
  bold?: boolean
  class?: HTMLAttributes['class']
}>(), {
  modelValue: '',
  placeholder: '',
  editable: true,
  multiline: false,
  inline: false,
  bold: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur', value: string): void
  (e: 'focus'): void
}>()

const elRef = ref<HTMLElement | null>(null)

function onInput(e: Event) {
  const text = (e.target as HTMLElement).textContent || ''
  emit('update:modelValue', text)
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  const selection = window.getSelection()
  if (!selection?.rangeCount) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  range.insertNode(document.createTextNode(text))
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  emit('update:modelValue', elRef.value?.textContent || '')
}

function onBlur() {
  emit('blur', elRef.value?.textContent || '')
}

function onFocus() {
  emit('focus')
}

// Sync prop → DOM (only when they diverge, to avoid cursor jumps)
watch(() => props.modelValue, (val) => {
  nextTick(() => {
    if (elRef.value && elRef.value.textContent !== val) {
      elRef.value.textContent = val || ''
    }
  })
}, { immediate: true })

defineExpose({
  el: elRef,
})
</script>

<template>
  <div
    ref="elRef"
    :contenteditable="editable"
    :data-placeholder="placeholder"
    role="textbox"
    :aria-multiline="multiline"
    :aria-readonly="!editable || undefined"
    :aria-placeholder="placeholder || undefined"
    :class="cn(
      'outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60',
      multiline && 'whitespace-pre-wrap',
      inline && 'text-sm py-0.5',
      bold && 'font-semibold',
      !editable && 'cursor-default',
      props.class,
    )"
    @input="onInput"
    @paste="onPaste"
    @blur="onBlur"
    @focus="onFocus"
  />
</template>

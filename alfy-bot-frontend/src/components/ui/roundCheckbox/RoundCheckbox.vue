<template>
  <label class="round-checkbox">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="handleChange"
      :disabled="disabled"
      class="round-checkbox__input"
    />
    <span class="round-checkbox__icon">
      <div
        :class="[
          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
          modelValue ? 'bg-blue-500 border-blue-500' : 'border-gray-300',
          disabled && 'opacity-50'
        ]"
      >
        <Check
          v-if="modelValue"
          :size="14"
          class="text-white"
          :stroke-width="3"
        />
      </div>
    </span>
    <span v-if="$slots.default" class="round-checkbox__label">
      <slot></slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineOptions({
  name: 'RoundCheckbox'
})

interface Props {
  modelValue?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<style scoped>
.round-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.round-checkbox__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.round-checkbox__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.round-checkbox__input:disabled ~ .round-checkbox__label {
  color: #9ca3af;
  cursor: not-allowed;
}

.round-checkbox__input:disabled ~ .round-checkbox__icon {
  cursor: not-allowed;
}

.round-checkbox:hover .round-checkbox__input:not(:disabled):not(:checked) ~ .round-checkbox__icon div {
  border-color: #3b82f6;
}

.round-checkbox__label {
  font-size: 0.875rem;
  color: #374151;
}
</style>

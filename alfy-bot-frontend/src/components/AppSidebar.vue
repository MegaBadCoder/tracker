<script setup lang="ts">
import { computed, ref } from 'vue'
import UserSection from './UserSection.vue'
import SidebarNav from './SidebarNav.vue'
import type { NavLink } from '@/types/navigation'
import { navLinks } from '@/router/nav'

const props = defineProps<{
  open: boolean
  links?: NavLink[]
}>()

const emit = defineEmits<{
  close: []
  open: []
}>()

const PANEL_WIDTH = 288 // w-72
const EDGE_WIDTH = 20
const DIRECTION_LOCK_THRESHOLD = 8
const COMMIT_RATIO = 1 / 3

type DragMode = 'open' | 'close'

const dragMode = ref<DragMode | null>(null)
const dragOffset = ref(0) // 0 = closed, PANEL_WIDTH = fully open
const startX = ref(0)
const startY = ref(0)
const directionLocked = ref(false)
const isHorizontalDrag = ref(false)

const isDragging = computed(
  () => dragMode.value !== null && directionLocked.value && isHorizontalDrag.value,
)

const currentOffset = computed(() => {
  if (isDragging.value) return clamp(dragOffset.value, 0, PANEL_WIDTH)
  return props.open ? PANEL_WIDTH : 0
})

const progress = computed(() => currentOffset.value / PANEL_WIDTH)

const panelStyle = computed(() => ({
  transform: `translateX(${currentOffset.value - PANEL_WIDTH}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.2s ease',
}))

const backdropStyle = computed(() => ({
  opacity: progress.value * 0.5,
  transition: isDragging.value ? 'none' : 'opacity 0.2s ease',
}))

const overlayInteractive = computed(() => props.open || isDragging.value)

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function onTouchStart(e: TouchEvent, mode: DragMode) {
  const t = e.touches[0]
  if (!t || e.touches.length !== 1) return
  if (mode === 'close' && !props.open) return
  if (mode === 'open' && props.open) return
  dragMode.value = mode
  startX.value = t.clientX
  startY.value = t.clientY
  directionLocked.value = false
  isHorizontalDrag.value = false
  dragOffset.value = mode === 'open' ? 0 : PANEL_WIDTH
}

function onTouchMove(e: TouchEvent) {
  if (!dragMode.value) return
  const t = e.touches[0]
  if (!t || e.touches.length !== 1) return
  const dx = t.clientX - startX.value
  const dy = t.clientY - startY.value

  if (!directionLocked.value) {
    if (Math.hypot(dx, dy) < DIRECTION_LOCK_THRESHOLD) return
    directionLocked.value = true
    isHorizontalDrag.value = Math.abs(dx) > Math.abs(dy)
    if (!isHorizontalDrag.value) {
      dragMode.value = null
      return
    }
  }

  if (dragMode.value === 'open') {
    dragOffset.value = clamp(dx, 0, PANEL_WIDTH)
  } else {
    dragOffset.value = clamp(PANEL_WIDTH + dx, 0, PANEL_WIDTH)
  }
}

function onTouchEnd() {
  if (!dragMode.value || !directionLocked.value || !isHorizontalDrag.value) {
    resetDrag()
    return
  }
  const threshold = PANEL_WIDTH * COMMIT_RATIO
  if (dragMode.value === 'open' && dragOffset.value > threshold) {
    emit('open')
  } else if (dragMode.value === 'close' && dragOffset.value < PANEL_WIDTH - threshold) {
    emit('close')
  }
  resetDrag()
}

function resetDrag() {
  dragMode.value = null
  dragOffset.value = 0
  directionLocked.value = false
  isHorizontalDrag.value = false
}
</script>

<template>
  <!-- Desktop sidebar -->
  <aside class="hidden sm:flex flex-col w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
    <div class="p-4 pt-5">
      <UserSection :links="navLinks" />
    </div>
    <SidebarNav v-if="links?.length" :links="links" />
    <slot name="section-extra" />
  </aside>

  <!-- Mobile: edge detector for swipe-to-open + sliding panel -->
  <Teleport to="body">
    <div
      v-show="!open && !isDragging"
      class="fixed left-0 top-0 bottom-0 z-30 sm:hidden"
      :style="{ width: `${EDGE_WIDTH}px`, touchAction: 'pan-y' }"
      @touchstart.passive="onTouchStart($event, 'open')"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="resetDrag"
    />

    <div
      class="fixed inset-0 z-40 sm:hidden"
      :class="overlayInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
    >
      <div
        class="absolute inset-0 bg-black"
        :style="backdropStyle"
        @click="emit('close')"
      />
      <aside
        class="absolute left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border shadow-lg"
        :style="[panelStyle, { touchAction: 'pan-y' }]"
        @touchstart.passive="onTouchStart($event, 'close')"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="resetDrag"
      >
        <div class="p-4 pt-5">
          <UserSection :links="navLinks" />
        </div>
        <SidebarNav v-if="links?.length" :links="links" />
        <slot name="section-extra" />
      </aside>
    </div>
  </Teleport>
</template>

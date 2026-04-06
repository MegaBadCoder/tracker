import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useGrabScroll(containerRef: Ref<HTMLElement | null>) {
  const grabbing = ref(false)
  const ctrlHeld = ref(false)

  let startX = 0
  let startY = 0
  let scrollLeftStart = 0
  let scrollTopStart = 0

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlHeld.value = true
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlHeld.value = false
      grabbing.value = false
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (!ctrlHeld.value || !containerRef.value) return
    e.preventDefault()
    grabbing.value = true
    startX = e.clientX
    startY = e.clientY
    scrollLeftStart = containerRef.value.scrollLeft
    scrollTopStart = containerRef.value.scrollTop
  }

  function onMouseMove(e: MouseEvent) {
    if (!grabbing.value || !containerRef.value) return
    e.preventDefault()
    containerRef.value.scrollLeft = scrollLeftStart - (e.clientX - startX)
    containerRef.value.scrollTop = scrollTopStart - (e.clientY - startY)
  }

  function onMouseUp() {
    grabbing.value = false
  }

  function onBlur() {
    ctrlHeld.value = false
    grabbing.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  })

  return { grabbing, ctrlHeld, onMouseDown, onMouseMove, onMouseUp }
}

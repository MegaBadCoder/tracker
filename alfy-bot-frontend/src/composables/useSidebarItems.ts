import type { Component } from 'vue'
import { ref } from 'vue'

export interface SidebarItem {
  label: string
  to?: string
  icon?: Component
  action?: () => void
  isActive?: boolean
}

export interface SidebarSection {
  title?: string
  items: SidebarItem[]
}

const sections = ref<SidebarSection[]>([])

export function useSidebarItems() {
  function setSections(value: SidebarSection[]) {
    sections.value = value
  }

  function clearSections() {
    sections.value = []
  }

  return {
    sections,
    setSections,
    clearSections,
  }
}
